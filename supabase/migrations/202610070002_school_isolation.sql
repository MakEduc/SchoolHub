-- Requires all prior migrations. Legacy SchoolHub data belongs to Druga gimnazija.
begin;
create table public.schools (id uuid primary key default gen_random_uuid(),name text not null,active boolean not null default true);
create table public.school_domains (domain text primary key check (domain=lower(domain) and domain ~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$'),school_id uuid not null references public.schools(id));
insert into public.schools(id,name) values ('30000000-0000-4000-8000-000000000001','Druga gimnazija');
insert into public.school_domains(domain,school_id) values ('2gimnazija.edu.ba','30000000-0000-4000-8000-000000000001');
-- Add other schools/domains here before backfilling if this database already hosts them.
create table public.school_challenges (id text primary key check (id ~ '^[a-f0-9]{64}$'),school_id uuid not null references public.schools(id),code_hash text not null,attempts integer not null default 0,expires_at timestamptz not null default now()+interval '10 minutes');
create table public.school_sessions (token_hash text primary key,school_id uuid not null references public.schools(id),expires_at timestamptz not null default now()+interval '7 days');
create index school_sessions_expiry on public.school_sessions(expires_at);
create index school_challenges_expiry on public.school_challenges(expires_at);
alter table public.departments add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.departments alter column school_id drop default;
create index departments_school on public.departments(school_id);
alter table public.subjects add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.subjects alter column school_id drop default;
create index subjects_school on public.subjects(school_id);
alter table public.locations add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.locations alter column school_id drop default;
create index locations_school on public.locations(school_id);
alter table public.teacher_profiles add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.teacher_profiles alter column school_id drop default;
create index teacher_profiles_school on public.teacher_profiles(school_id);
alter table public.teacher_departments add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.teacher_departments alter column school_id drop default;
create index teacher_departments_school on public.teacher_departments(school_id);
alter table public.questions add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.questions alter column school_id drop default;
create index questions_school on public.questions(school_id);
alter table public.public_boards add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.public_boards alter column school_id drop default;
create index public_boards_school on public.public_boards(school_id);
alter table public.board_questions add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.board_questions alter column school_id drop default;
create index board_questions_school on public.board_questions(school_id);
alter table public.study_sessions add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.study_sessions alter column school_id drop default;
create index study_sessions_school on public.study_sessions(school_id);
alter table public.debate_sessions add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.debate_sessions alter column school_id drop default;
create index debate_sessions_school on public.debate_sessions(school_id);
alter table public.debate_stances add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.debate_stances alter column school_id drop default;
create index debate_stances_school on public.debate_stances(school_id);
alter table public.debate_participants add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.debate_participants alter column school_id drop default;
create index debate_participants_school on public.debate_participants(school_id);
alter table public.staff_actions add column school_id uuid not null default '30000000-0000-4000-8000-000000000001' references public.schools(id);
alter table public.staff_actions alter column school_id drop default;
create index staff_actions_school on public.staff_actions(school_id);
do $$ begin
  if exists(select 1 from public.teacher_profiles p join auth.users u on p.id=u.id where not exists(select 1 from public.school_domains d where d.domain=lower(split_part(u.email,'@',2)) and d.school_id=p.school_id)) then
    raise exception 'Existing teacher email domains do not match Druga gimnazija. Map legacy schools and domains explicitly before migrating.';
  end if;
end $$;
alter table public.departments add unique(id,school_id);
alter table public.subjects add unique(id,school_id);
alter table public.locations add unique(id,school_id);
alter table public.teacher_profiles add unique(id,school_id);
alter table public.questions add unique(id,school_id);
alter table public.public_boards add unique(id,school_id);
alter table public.debate_sessions add unique(id,school_id);
alter table public.departments drop constraint departments_name_key;
alter table public.departments add unique(school_id,name);
alter table public.subjects drop constraint subjects_name_key;
alter table public.subjects add unique(school_id,name);
alter table public.locations drop constraint locations_name_key;
alter table public.locations add unique(school_id,name);
alter table public.public_boards drop constraint public_boards_slug_key;
alter table public.public_boards add unique(school_id,slug);
alter table public.subjects add foreign key (department_id,school_id) references public.departments(id,school_id);
alter table public.teacher_departments add foreign key (teacher_id,school_id) references public.teacher_profiles(id,school_id);
alter table public.teacher_departments add foreign key (department_id,school_id) references public.departments(id,school_id);
alter table public.questions add foreign key (teacher_id,school_id) references public.teacher_profiles(id,school_id);
alter table public.questions add foreign key (department_id,school_id) references public.departments(id,school_id);
alter table public.public_boards add foreign key (owner_id,school_id) references public.teacher_profiles(id,school_id);
alter table public.board_questions add foreign key (board_id,school_id) references public.public_boards(id,school_id);
alter table public.board_questions add foreign key (question_id,school_id) references public.questions(id,school_id);
alter table public.board_questions add foreign key (published_by,school_id) references public.teacher_profiles(id,school_id);
alter table public.study_sessions add foreign key (subject_id,school_id) references public.subjects(id,school_id);
alter table public.study_sessions add foreign key (location_id,school_id) references public.locations(id,school_id);
alter table public.debate_sessions add foreign key (teacher_id,school_id) references public.teacher_profiles(id,school_id);
alter table public.debate_stances add foreign key (session_id,school_id) references public.debate_sessions(id,school_id);
alter table public.debate_participants add foreign key (session_id,school_id) references public.debate_sessions(id,school_id);
alter table public.staff_actions add foreign key (staff_id,school_id) references public.teacher_profiles(id,school_id);

-- Existing server RPCs inherit tenant identity from their parent rather than accepting client input.
create function public.inherit_school() returns trigger language plpgsql set search_path='' as $$
declare parent_school uuid;
begin
  if tg_table_name='debate_sessions' then select school_id into parent_school from public.teacher_profiles where id=new.teacher_id;
  elsif tg_table_name='debate_stances' or tg_table_name='debate_participants' then select school_id into parent_school from public.debate_sessions where id=new.session_id;
  elsif tg_table_name='board_questions' then select school_id into parent_school from public.public_boards where id=new.board_id;
  elsif tg_table_name='staff_actions' then select school_id into parent_school from public.teacher_profiles where id=new.staff_id;
  elsif tg_table_name='teacher_departments' then select school_id into parent_school from public.teacher_profiles where id=new.teacher_id;
  end if;
  if new.school_id is not null and new.school_id<>parent_school then raise exception 'School mismatch'; end if;
  new.school_id:=parent_school;
  return new;
end;
$$;
create trigger inherit_school before insert or update on public.debate_sessions for each row execute function public.inherit_school();
create trigger inherit_school before insert or update on public.debate_stances for each row execute function public.inherit_school();
create trigger inherit_school before insert or update on public.debate_participants for each row execute function public.inherit_school();
create trigger inherit_school before insert or update on public.board_questions for each row execute function public.inherit_school();
create trigger inherit_school before insert or update on public.staff_actions for each row execute function public.inherit_school();
create trigger inherit_school before insert or update on public.teacher_departments for each row execute function public.inherit_school();

create function public.validate_teacher_school() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users u join public.school_domains d on d.domain=lower(split_part(u.email,'@',2)) where u.id=new.id and d.school_id=new.school_id) then raise exception 'Teacher email does not match school'; end if;
  return new;
end; $$;
create trigger validate_teacher_school before insert or update of school_id on public.teacher_profiles for each row execute function public.validate_teacher_school();
create function public.current_staff_school() returns uuid language sql stable security definer set search_path='' as $$
  select p.school_id from public.teacher_profiles p join public.schools s on s.id=p.school_id join auth.users u on u.id=p.id join public.school_domains d on d.domain=lower(split_part(u.email,'@',2)) and d.school_id=p.school_id where p.id=auth.uid() and p.active and s.active and u.email_confirmed_at is not null;
$$;
-- No anonymous or authenticated direct REST view can bypass school verification.
revoke all on public.teacher_directory,public.active_study_sessions,public.published_questions,public.public_questions from anon,authenticated;
revoke all on public.departments,public.subjects,public.locations,public.public_boards from anon,authenticated;
create or replace view public.teacher_directory as select id,display_name,school_id from public.teacher_profiles where active;
create or replace view public.active_study_sessions as
 select s.id,s.programme,s.grade,s.subject_id,s.focus,s.location_id,s.custom_location,s.starts_at,s.ends_at,s.open_spots,s.host_name,s.contact,s.created_at,
 jsonb_build_object('name',sub.name) as subject,jsonb_build_object('name',loc.name) as location,s.school_id
 from public.study_sessions s join public.subjects sub on sub.id=s.subject_id join public.locations loc on loc.id=s.location_id where s.cancelled_at is null and s.ends_at>now();
create or replace view public.public_questions as select id,body,status,created_at,answer,answered_at,school_id from public.questions where visibility='public' and moderation_status='approved' and status<>'archived';
create or replace view public.published_questions as
 select b.slug,b.title,q.id,q.body,q.status,bq.published_at,q.answer,q.answered_at,q.school_id from public.board_questions bq
 join public.public_boards b on b.id=bq.board_id join public.questions q on q.id=bq.question_id
 where q.visibility='public' and q.moderation_status='approved' and q.status<>'archived';
drop policy staff_profile_read on public.teacher_profiles;
create policy staff_profile_read on public.teacher_profiles for select to authenticated using(school_id=public.current_staff_school() and (id=auth.uid() or public.is_admin()));
drop policy staff_memberships_read on public.teacher_departments;
create policy staff_memberships_read on public.teacher_departments for select to authenticated using(school_id=public.current_staff_school() and (teacher_id=auth.uid() or public.is_admin()));
drop policy staff_questions_read on public.questions;
create policy staff_questions_read on public.questions for select to authenticated using(school_id=public.current_staff_school() and public.can_read_question(teacher_id,department_id,recipient_type));
drop policy board_publications_staff_read on public.board_questions;
create policy board_publications_staff_read on public.board_questions for select to authenticated using(school_id=public.current_staff_school() and public.is_staff());
drop policy audit_admin_read on public.staff_actions;
create policy audit_admin_read on public.staff_actions for select to authenticated using(school_id=public.current_staff_school() and public.is_admin());
drop policy debate_owner_read on public.debate_sessions;
create policy debate_owner_read on public.debate_sessions for select to authenticated using(school_id=public.current_staff_school() and public.is_staff() and teacher_id=auth.uid());
drop policy stance_owner_read on public.debate_stances;
create policy stance_owner_read on public.debate_stances for select to authenticated using(school_id=public.current_staff_school() and exists(select 1 from public.debate_sessions where id=session_id and teacher_id=auth.uid()));
drop policy participant_owner_read on public.debate_participants;
create policy participant_owner_read on public.debate_participants for select to authenticated using(school_id=public.current_staff_school() and exists(select 1 from public.debate_sessions where id=session_id and teacher_id=auth.uid()));
create or replace function public.mutate_question(p_staff uuid,p_question uuid,p_action text,p_board uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare q public.questions; actor public.teacher_profiles;
begin
  select * into actor from public.teacher_profiles where id=p_staff and active;
  if not found then raise exception 'Teacher unavailable'; end if;
  select * into q from public.questions where id=p_question for update;
  if not found then raise exception 'Question unavailable'; end if;
  if q.school_id<>actor.school_id then raise exception 'Question unavailable'; end if;
  if (actor.role='admin' or q.teacher_id=p_staff or
    (q.recipient_type='general' and actor.handles_general) or
    exists(select 1 from public.teacher_departments where teacher_id=p_staff and department_id=q.department_id)) is not true then
    raise exception 'Question unavailable';
  end if;
  if p_action in ('pin','unpin') then
    if not exists(select 1 from public.public_boards where id=p_board and owner_id=p_staff) then raise exception 'Choose one of your boards'; end if;
    if p_action='pin' then
      if q.visibility<>'public' then raise exception 'Private questions cannot be published'; end if;
      if q.moderation_status<>'approved' then raise exception 'Review and approve this question before publishing'; end if;
      if q.status='archived' then raise exception 'Restore this question before publishing'; end if;
      insert into public.board_questions(board_id,question_id,published_by) values(p_board,q.id,p_staff)
        on conflict(board_id,question_id) do nothing;
    else delete from public.board_questions where board_id=p_board and question_id=q.id; end if;
  elsif p_action='approve' then update public.questions set moderation_status='approved' where id=q.id;
  elsif p_action='answer' then update public.questions set status='answered',answered_at=now() where id=q.id;
  elsif p_action='archive' then
    update public.questions set status='archived' where id=q.id;
    -- Restoring an inbox question must not silently republish it.
    delete from public.board_questions where question_id=q.id;
  elsif p_action='restore' then update public.questions set status='new',answered_at=null where id=q.id;
  else raise exception 'Unknown question action'; end if;
  insert into public.staff_actions(staff_id,action,target_id) values(p_staff,'question.'||p_action,q.id);
end;
$$;
create or replace function public.answer_question(p_staff uuid,p_question uuid,p_answer text) returns void
language plpgsql security definer set search_path='' as $$
declare q public.questions; actor public.teacher_profiles;
begin
  select * into actor from public.teacher_profiles where id=p_staff and active;
  if not found then raise exception 'Teacher unavailable'; end if;
  select * into q from public.questions where id=p_question for update;
  if not found then raise exception 'Question unavailable'; end if;
  if q.school_id<>actor.school_id then raise exception 'Question unavailable'; end if;
  if (actor.role='admin' or q.teacher_id=p_staff or
    (q.recipient_type='general' and actor.handles_general) or
    exists(select 1 from public.teacher_departments where teacher_id=p_staff and department_id=q.department_id)) is not true then
    raise exception 'Question unavailable';
  end if;
  if q.status='archived' then raise exception 'Restore this question before answering'; end if;
  if p_answer is null or char_length(btrim(p_answer)) not between 1 and 2000 then raise exception 'Write an answer of 1-2000 characters'; end if;
  update public.questions set answer=btrim(p_answer),status='answered',answered_at=now() where id=q.id;
  insert into public.staff_actions(staff_id,action,target_id) values(p_staff,'question.answer',q.id);
end;
$$;
drop function public.join_debate(text,text,text);
create function public.join_debate(p_code text,p_name text,p_token_hash text,p_school uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.debate_sessions; participant_id uuid;
begin
  select * into s from public.debate_sessions where join_code=p_code and school_id=p_school for update;
  if not found or s.expires_at<=now() then raise exception 'Lobby not found or expired'; end if;
  if s.status<>'lobby' then raise exception 'This lobby is closed to new participants'; end if;
  if (select count(*) from public.debate_participants where session_id=s.id)>=100 then raise exception 'Lobby is full'; end if;
  insert into public.debate_participants(session_id,display_name,token_hash) values(s.id,p_name,p_token_hash) returning id into participant_id;
  return participant_id;
end;
$$;
revoke all on function public.join_debate(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.join_debate(text,text,text,uuid) to service_role;

create function public.verify_school_code(p_challenge text,p_code_hash text,p_session_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.school_challenges;
begin
 select * into c from public.school_challenges where id=p_challenge for update;
 if not found then return null; end if;
 if c.expires_at<=now() or c.attempts>=5 then delete from public.school_challenges where id=c.id; return null; end if;
 if c.code_hash<>p_code_hash then update public.school_challenges set attempts=attempts+1 where id=c.id; return null; end if;
 if not exists(select 1 from public.schools where id=c.school_id and active) then return null; end if;
 delete from public.school_challenges where id=c.id;
 insert into public.school_sessions(token_hash,school_id) values(p_session_hash,c.school_id);
 return c.school_id;
end; $$;
revoke all on function public.verify_school_code(text,text,text) from public,anon,authenticated;
grant execute on function public.verify_school_code(text,text,text) to service_role;
alter table public.schools enable row level security;
revoke all on public.schools from anon,authenticated;
alter table public.school_domains enable row level security;
revoke all on public.school_domains from anon,authenticated;
alter table public.school_challenges enable row level security;
revoke all on public.school_challenges from anon,authenticated;
alter table public.school_sessions enable row level security;
revoke all on public.school_sessions from anon,authenticated;
grant all on all tables in schema public to service_role;
grant select on public.teacher_directory,public.active_study_sessions,public.published_questions,public.public_questions to service_role;
drop policy directory_read on public.departments;
create policy directory_read on public.departments for select to authenticated using(school_id=public.current_staff_school());
grant select on public.departments to authenticated;
drop policy directory_read on public.subjects;
create policy directory_read on public.subjects for select to authenticated using(school_id=public.current_staff_school());
grant select on public.subjects to authenticated;
drop policy directory_read on public.locations;
create policy directory_read on public.locations for select to authenticated using(school_id=public.current_staff_school());
grant select on public.locations to authenticated;
drop policy boards_read on public.public_boards;
create policy boards_read on public.public_boards for select to authenticated using(school_id=public.current_staff_school());
grant select on public.public_boards to authenticated;
drop function public.update_teacher_access(uuid,boolean,uuid[]);
create function public.update_teacher_access(p_actor uuid,p_teacher uuid,p_general boolean,p_departments uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 select school_id into tenant from public.teacher_profiles where id=p_actor and active and role='admin';
 if tenant is null or not exists(select 1 from public.teacher_profiles where id=p_teacher and school_id=tenant) then raise exception 'Teacher unavailable'; end if;
 if exists(select 1 from unnest(p_departments) x where not exists(select 1 from public.departments where id=x and school_id=tenant)) then raise exception 'Department unavailable'; end if;
 update public.teacher_profiles set handles_general=p_general where id=p_teacher;
 delete from public.teacher_departments where teacher_id=p_teacher;
 insert into public.teacher_departments(teacher_id,department_id) select p_teacher,unnest(p_departments);
end; $$;
revoke all on function public.update_teacher_access(uuid,uuid,boolean,uuid[]) from public,anon,authenticated;
grant execute on function public.update_teacher_access(uuid,uuid,boolean,uuid[]) to service_role;
notify pgrst,'reload schema';
commit;
