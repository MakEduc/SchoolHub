import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { schoolEmailDomain, verificationHash } from "../src/lib/school-verification";

test("school domains use exact email domains and codes are challenge-bound", () => {
  assert.equal(schoolEmailDomain(" A@2gimnazija.edu.ba "), "2gimnazija.edu.ba");
  assert.equal(schoolEmailDomain("a@2gimnazija.edu.ba.attacker.com"), "2gimnazija.edu.ba.attacker.com");
  assert.equal(schoolEmailDomain("a@2gimnazija.edu.ba\nBcc: a@evil.com"), null);
  assert.notEqual(verificationHash("a", "123456", "secret"), verificationHash("b", "123456", "secret"));
});

test("school isolation migration blocks cross-school access and verifies single-use codes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const name of ["202610060001_schoolhub.sql", "202610060003_library_details.sql", "202610070001_question_replies.sql", "202610070002_school_isolation.sql"]) {
      const sql = (await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", "").replace(/alter publication supabase_realtime add table [^;]+;/, "");
      await db.exec(sql);
    }
    const school = "30000000-0000-4000-8000-000000000001", other = "30000000-0000-4000-8000-000000000002";
    const admin = "20000000-0000-4000-8000-000000000001", teacher = "20000000-0000-4000-8000-000000000002";
    await db.query("insert into schools(id,name) values ($1,'Other school')", [other]);
    await db.query("insert into school_domains values ('other.edu.ba',$1)", [other]);
    await db.query("insert into auth.users(id,email) values ($1,'admin@2gimnazija.edu.ba'),($2,'teacher@other.edu.ba')", [admin,teacher]);
    await db.query("insert into teacher_profiles(id,display_name,role,school_id) values ($1,'Admin','admin',$3),($2,'Teacher','teacher',$4)", [admin,teacher,school,other]);
    await assert.rejects(db.query("insert into questions(body,recipient_type,teacher_id,school_id) values ('Cross-school','teacher',$1,$2)", [teacher,school]), /foreign key/);
    await db.query("insert into questions(body,recipient_type,school_id) values ('Own school','general',$1),('Other school','general',$2)", [school,other]);
    const q = (await db.query<{id:string}>("select id from questions where body='Other school'")).rows[0].id;
    await assert.rejects(db.query("select answer_question($1,$2,'Forbidden')", [admin,q]), /Question unavailable/);
    await assert.rejects(db.query("select update_teacher_access($1,$2,true,'{}')", [admin,teacher]), /Teacher unavailable/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
    await db.exec("set role authenticated");
    assert.deepEqual((await db.query<{body:string}>("select body from questions")).rows.map(r=>r.body), ["Own school"]);
    assert.equal((await db.query("select * from teacher_profiles")).rows.length, 1);
    await assert.rejects(db.query("select * from public_questions"), /permission denied/);
    await db.exec("reset role; set role anon");
    for (const table of ["questions","public_questions","published_questions","active_study_sessions","teacher_directory","public_boards","school_challenges","school_sessions","school_domains"]) await assert.rejects(db.query(`select * from ${table}`), /permission denied/);
    await assert.rejects(db.query("select verify_school_code('a','b','c')"), /permission denied/);
    await db.exec("reset role");
    await db.query("update auth.users set email='admin@other.edu.ba' where id=$1", [admin]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from questions")).rows.length, 0, "changing an Auth email cannot retain the old school's access");
    await db.exec("reset role");
    await db.query("update auth.users set email='admin@2gimnazija.edu.ba' where id=$1", [admin]);
    const student = "20000000-0000-4000-8000-000000000005";
    await db.query("insert into auth.users(id,email) values($1,'student@2gimnazija.edu.ba')", [student]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [student]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from questions")).rows.length, 0, "student Auth accounts cannot bypass anonymous API projections");
    assert.equal((await db.query("select * from teacher_profiles")).rows.length, 0);
    await assert.rejects(db.query("insert into teacher_profiles(id,display_name,role,school_id) values(auth.uid(),'Forged','admin','30000000-0000-4000-8000-000000000001')"), /permission denied/);
    await assert.rejects(db.query("select answer_question(auth.uid(),'20000000-0000-4000-8000-000000000006','Forged answer')"), /permission denied/);
    await db.exec("reset role");
    const challenge = "a".repeat(64), session = "b".repeat(64);
    await db.query("insert into school_challenges(id,school_id,code_hash) values($1,$2,'correct')", [challenge,school]);
    for (let i=0;i<5;i++) assert.equal((await db.query<{result:string|null}>("select verify_school_code($1,'wrong',$2) result", [challenge,session])).rows[0].result, null);
    assert.equal((await db.query<{result:string|null}>("select verify_school_code($1,'correct',$2) result", [challenge,session])).rows[0].result, null);
    await db.query("insert into school_challenges(id,school_id,code_hash) values($1,$2,'correct')", [challenge,school]);
    assert.equal((await db.query<{result:string}>("select verify_school_code($1,'correct',$2) result", [challenge,session])).rows[0].result, school);
    assert.equal((await db.query<{result:null}>("select verify_school_code($1,'correct',$2) result", [challenge,session])).rows[0].result, null);
    assert.equal((await db.query("select * from school_sessions")).rows.length,1);
    await db.query("insert into school_challenges(id,school_id,code_hash,expires_at) values($1,$2,'correct',now()-interval '1 second')", [challenge,school]);
    assert.equal((await db.query<{result:null}>("select verify_school_code($1,'correct','expired-session') result", [challenge])).rows[0].result, null);
    const columns = (await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name in ('school_sessions','school_challenges')")).rows;
    assert.ok(!columns.some(c=>/email|user_id/.test(c.column_name)));
    const debate = (await db.query<{id:string}>("select create_debate($1,'Prompt',array['Yes','No'],60,'ABC123') id", [teacher])).rows[0].id;
    assert.ok(debate);
    await assert.rejects(db.query("select join_debate('ABC123','Student','token',$1)", [school]), /Lobby not found/);
    await db.query("select join_debate('ABC123','Student','token',$1)", [other]);
  } finally { await db.close(); }
});
