import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { balancedAssignments } from "../src/lib/domain";

test("Postgres schema enforces RLS, public projections, expiration, and atomic debate operations", async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  const migration = (await readFile(new URL("../supabase/migrations/202610060001_schoolhub.sql", import.meta.url), "utf8"))
    .replace("create extension if not exists pgcrypto;", "-- gen_random_uuid is built in to this test Postgres.")
    .replace(/alter publication supabase_realtime add table [^;]+;/, "-- Publication transport is provided by Supabase, not embedded Postgres.");
  await db.exec(migration);
  await db.exec(`insert into public.study_sessions(programme,grade,subject_id,focus,location_id,starts_at,ends_at,management_token_hash)
    select 'DP','Grade I',s.id,'Legacy session',l.id,now(),now()+interval '1 hour','legacy-key' from public.subjects s cross join public.locations l where s.name='Physics' and l.name='Library';`);
  await db.exec(await readFile(new URL("../supabase/migrations/202610060003_library_details.sql", import.meta.url), "utf8"));
  const legacy = (await db.query<{programme:string;custom_location:string;management_token_hash:string}>("select programme,custom_location,management_token_hash from public.study_sessions where focus='Legacy session'")).rows[0];
  assert.deepEqual(legacy, {programme:'IB',custom_location:'Library',management_token_hash:'legacy-key'});
  await db.exec("delete from public.study_sessions where focus='Legacy session'");
  await assert.rejects(db.exec(`insert into public.study_sessions(programme,grade,subject_id,focus,location_id,custom_location,starts_at,ends_at,management_token_hash)
    select 'DP','Grade I',s.id,'Invalid programme',l.id,'Library',now(),now()+interval '1 hour','test-key' from public.subjects s cross join public.locations l where s.name='Physics' and l.name='Library';`), /constraint/);
  await assert.rejects(db.exec(`insert into public.study_sessions(programme,grade,subject_id,focus,location_id,custom_location,starts_at,ends_at,management_token_hash)
    select 'IB','Grade IV',s.id,'Missing place',l.id,'   ',now(),now()+interval '1 hour','test-key' from public.subjects s cross join public.locations l where s.name='Physics' and l.name='Library';`), /constraint/);
  const teacher = "20000000-0000-4000-8000-000000000001", other = "20000000-0000-4000-8000-000000000002", admin = "20000000-0000-4000-8000-000000000003";
  const department = "10000000-0000-4000-8000-000000000001";
  await db.query("insert into auth.users values ($1),($2),($3)", [teacher, other, admin]);
  await db.query("insert into public.teacher_profiles(id,display_name,role) values ($1,'First teacher','teacher'),($2,'Other teacher','teacher'),($3,'Admin','admin')", [teacher,other,admin]);
  await db.query("insert into public.teacher_departments values ($1,$2)", [teacher, department]);
  await db.query("insert into public.questions(body,recipient_type,teacher_id,department_id) values ('Personal question','teacher',$1,null),('Other private question','teacher',$2,null),('Department question','department',null,$3),('General question','general',null,null)", [teacher,other,department]);
  await t.test("anonymous clients see the directory, but cannot read private questions or call server RPCs", async () => {
    await db.exec("set role anon");
    assert.equal((await db.query("select * from public.teacher_directory")).rows.length, 3);
    await assert.rejects(db.query("select * from public.questions"), /permission denied/);
    await assert.rejects(db.query("select public.consume_rate_limit('forged',999,1)"), /permission denied/);
    assert.equal((await db.query("select * from public.published_questions")).rows.length, 0);
    await db.exec("reset role");
  });
  await t.test("teacher RLS allows personal and department questions, but hides other inboxes and role writes", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [teacher]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from public.questions")).rows.length, 2);
    assert.equal((await db.query("select * from public.teacher_profiles")).rows.length, 1);
    await assert.rejects(db.query("update public.teacher_profiles set role='admin'"), /permission denied/);
    await assert.rejects(db.query("update public.questions set status='answered'"), /permission denied/);
    await db.exec("reset role");
  });
  await t.test("public boards expose only approved, explicitly published, nonarchived text", async () => {
    await db.query("insert into public.public_boards(slug,title,owner_id) values ('math-board','Math board',$1)", [teacher]);
    await db.query("insert into public.board_questions(board_id,question_id,published_by) select b.id,q.id,$1 from public.public_boards b cross join public.questions q where q.body='Personal question'", [teacher]);
    await db.exec("set role anon");
    const published = (await db.query<{ body: string }>("select * from public.published_questions")).rows;
    assert.equal(published.length, 1); assert.equal(published[0].body, "Personal question");
    await db.exec("reset role");
    await db.exec("update public.questions set moderation_status='flagged' where body='Personal question'; set role anon;");
    assert.equal((await db.query("select * from public.published_questions")).rows.length, 0);
    await db.exec("reset role; update public.questions set moderation_status='approved',status='archived' where body='Personal question'; set role anon;");
    assert.equal((await db.query("select * from public.published_questions")).rows.length, 0);
    await db.exec("reset role");
  });
  await t.test("active study view hides expired/cancelled sessions and management secrets", async () => {
    await db.exec(`insert into public.study_sessions(programme,grade,subject_id,focus,location_id,custom_location,starts_at,ends_at,management_token_hash)
      select 'IB','Grade I',s.id,'Vectors',l.id,'Library',now()-interval '1 hour',now()+interval '1 hour','private-hash' from public.subjects s cross join public.locations l where s.name='Physics' and l.name='Library';
      insert into public.study_sessions(programme,grade,subject_id,focus,location_id,custom_location,starts_at,ends_at,management_token_hash)
      select 'IB','Grade I',s.id,'Expired',l.id,'Library',now()-interval '2 hours',now()-interval '1 hour','other-hash' from public.subjects s cross join public.locations l where s.name='Physics' and l.name='Library';
      set role anon;`);
    const active = (await db.query<Record<string, unknown>>("select * from public.active_study_sessions")).rows;
    assert.equal(active.length, 1); assert.equal(active[0].focus, "Vectors");
    assert.ok(!("management_token_hash" in active[0]));
    await assert.rejects(db.query("select management_token_hash from public.study_sessions"), /permission denied/);
    await db.exec("reset role; update public.study_sessions set cancelled_at=now() where focus='Vectors'; set role anon;");
    assert.equal((await db.query("select * from public.active_study_sessions")).rows.length, 0);
    await db.exec("reset role");
  });
  await t.test("moderation checks recipients and archives publications atomically without republishing on restore", async () => {
    const q = (await db.query<{ id: string }>("select id from public.questions where body='Personal question'")).rows[0].id;
    const board = (await db.query<{ id: string }>("select id from public.public_boards")).rows[0].id;
    await assert.rejects(db.query("select public.mutate_question($1,$2,'approve',null)", [other,q]), /Question unavailable/);
    const restricted = (await db.query<{ id: string }>("select id from public.questions where recipient_type in ('department','general')")).rows;
    for (const question of restricted) await assert.rejects(db.query("select public.mutate_question($1,$2,'approve',null)", [other,question.id]), /Question unavailable/);
    await db.query("select public.mutate_question($1,$2,'restore',null)", [teacher,q]);
    await db.query("select public.mutate_question($1,$2,'pin',$3)", [teacher,q,board]);
    assert.equal((await db.query("select * from public.published_questions")).rows.length,1);
    await db.query("select public.mutate_question($1,$2,'archive',null)", [teacher,q]);
    assert.equal((await db.query("select * from public.board_questions")).rows.length,0);
    await db.query("select public.mutate_question($1,$2,'restore',null)", [teacher,q]);
    assert.equal((await db.query("select * from public.published_questions")).rows.length,0);
    assert.ok((await db.query("select * from public.staff_actions")).rows.length >= 4);
  });
  await t.test("rate-limit increments are atomic and reset on expiry", async () => {
    assert.equal((await db.query<{ allowed: boolean }>("select public.consume_rate_limit('test',2,600) as allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select public.consume_rate_limit('test',2,600) as allowed")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select public.consume_rate_limit('test',2,600) as allowed")).rows[0].allowed, false);
    await db.exec("update public.rate_limits set expires_at=now()-interval '1 second'");
    assert.equal((await db.query<{ allowed: boolean }>("select public.consume_rate_limit('test',2,600) as allowed")).rows[0].allowed, true);
  });
  await t.test("debate RPCs reject stale rosters, duplicate assignment, wrong owners, and late joins", async () => {
    await assert.rejects(db.query("select public.create_debate($1,'A valid prompt',array[]::text[],300,'BAD123')", [teacher]), /2–4/);
    await assert.rejects(db.query("select public.create_debate($1,'A valid prompt',array['For','for'],300,'BAD123')", [teacher]), /distinct/);
    const session = (await db.query<{ id: string }>("select public.create_debate($1,'Should schools change assessment?',array['For','Against','Alternative'],300,'ABC123') as id", [teacher])).rows[0].id;
    for (let i = 0; i < 7; i++) await db.query("select public.join_debate('ABC123',$1,$2)", [`Student ${i}`,`hash-${i}`]);
    const students = (await db.query<{ id: string }>("select id from public.debate_participants where session_id=$1", [session])).rows;
    const stances = (await db.query<{ id: string }>("select id from public.debate_stances where session_id=$1", [session])).rows;
    const assignments = balancedAssignments(students, stances.map(s => s.id)).map(a => ({ participantId: a.student.id, stanceId: a.stanceId }));
    await assert.rejects(db.query("select public.assign_debate($1,$2,$3::jsonb)", [session,other,JSON.stringify(assignments)]), /Session unavailable/);
    await assert.rejects(db.query("select public.assign_debate($1,$2,$3::jsonb)", [session,teacher,JSON.stringify(assignments.slice(1))]), /Roster changed/);
    const unbalanced = assignments.map(a => ({ ...a, stanceId: stances[0].id }));
    await assert.rejects(db.query("select public.assign_debate($1,$2,$3::jsonb)", [session,teacher,JSON.stringify(unbalanced)]), /balanced/);
    await db.query("select public.assign_debate($1,$2,$3::jsonb)", [session,teacher,JSON.stringify(assignments)]);
    const counts = (await db.query<{ count: number }>("select count(*)::int as count from public.debate_participants where session_id=$1 group by stance_id", [session])).rows.map(r => r.count);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
    await assert.rejects(db.query("select public.assign_debate($1,$2,$3::jsonb)", [session,teacher,JSON.stringify(assignments)]), /already assigned/);
    await assert.rejects(db.query("select public.join_debate('ABC123','Late student','late-hash')"), /closed/);
    await assert.rejects(db.query("select public.remove_debate_participant($1,$2,$3)", [session,teacher,students[0].id]), /Reopen/);
    await db.query("select public.control_debate($1,$2,'start')", [session,teacher]);
    const deadline = (await db.query<{ timer_deadline: Date }>("select timer_deadline from public.debate_sessions where id=$1", [session])).rows[0].timer_deadline;
    await db.query("select public.control_debate($1,$2,'start')", [session,teacher]);
    assert.deepEqual((await db.query<{ timer_deadline: Date }>("select timer_deadline from public.debate_sessions where id=$1", [session])).rows[0].timer_deadline, deadline);
    await db.query("select public.control_debate($1,$2,'pause')", [session,teacher]);
    assert.equal((await db.query<{ timer_deadline: Date | null }>("select timer_deadline from public.debate_sessions where id=$1", [session])).rows[0].timer_deadline, null);
    await db.query("select public.control_debate($1,$2,'reopen')", [session,teacher]);
    assert.equal((await db.query("select stance_id from public.debate_participants where session_id=$1 and stance_id is not null", [session])).rows.length, 0);
    await db.query("select public.remove_debate_participant($1,$2,$3)", [session,teacher,students[0].id]);
    assert.equal((await db.query("select id from public.debate_participants where session_id=$1", [session])).rows.length, 6);
    await db.query("select public.control_debate($1,$2,'end')", [session,teacher]);
    await assert.rejects(db.query("select public.join_debate('ABC123','Late student','late-hash')"), /closed/);
  });
  await db.close();
});
