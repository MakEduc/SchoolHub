-- Run this complete migration in the Supabase SQL Editor.
begin;
create extension if not exists pgcrypto;

create table public.departments (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.subjects (id uuid primary key default gen_random_uuid(), name text not null unique, department_id uuid references public.departments);
create table public.locations (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.programme_grades (programme text not null, grade text not null, primary key (programme, grade));
create table public.teacher_profiles (
  id uuid primary key references auth.users on delete cascade, display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'teacher' check (role in ('teacher','admin')), active boolean not null default true,
  handles_general boolean not null default false, created_at timestamptz not null default now()
);
create table public.teacher_departments (
  teacher_id uuid references public.teacher_profiles on delete cascade,
  department_id uuid references public.departments on delete cascade, primary key (teacher_id, department_id)
);
create table public.questions (
  id uuid primary key default gen_random_uuid(), body text not null check (char_length(body) between 3 and 280),
  recipient_type text not null check (recipient_type in ('teacher','department','general')),
  teacher_id uuid references public.teacher_profiles, department_id uuid references public.departments,
  status text not null default 'new' check (status in ('new','answered','archived')),
  moderation_status text not null default 'approved' check (moderation_status in ('approved','flagged')),
  created_at timestamptz not null default now(), answered_at timestamptz,
  check ((recipient_type='teacher' and teacher_id is not null and department_id is null)
    or (recipient_type='department' and department_id is not null and teacher_id is null)
    or (recipient_type='general' and teacher_id is null and department_id is null))
);
create table public.public_boards (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  title text not null check (char_length(title) between 3 and 80), owner_id uuid not null references public.teacher_profiles
);
create table public.board_questions (
  board_id uuid references public.public_boards on delete cascade,
  question_id uuid references public.questions on delete cascade, published_by uuid not null references public.teacher_profiles,
  published_at timestamptz not null default now(), primary key (board_id,question_id)
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(), programme text not null, grade text not null,
  subject_id uuid not null references public.subjects, focus text not null check (char_length(focus) between 3 and 80),
  location_id uuid not null references public.locations, custom_location text check (char_length(custom_location) <= 80),
  starts_at timestamptz not null, ends_at timestamptz not null,
  open_spots integer check (open_spots between 1 and 99), host_name text check (char_length(host_name) <= 60), contact text check (char_length(contact) <= 80),
  management_token_hash text not null, cancelled_at timestamptz, created_at timestamptz not null default now(),
  foreign key (programme,grade) references public.programme_grades,
  check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours')
);
create table public.debate_sessions (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles,
  prompt text not null check (char_length(prompt) between 5 and 300),
  join_code text not null unique, status text not null default 'lobby' check (status in ('lobby','assigned','ended')),
  prep_seconds integer not null check (prep_seconds between 60 and 3600), timer_deadline timestamptz,
  timer_remaining integer check (timer_remaining between 0 and 3600), expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create table public.debate_stances (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.debate_sessions on delete cascade,
  label text not null check (char_length(label) between 1 and 80), position integer not null check (position between 0 and 3),
  unique (session_id,position), unique(id,session_id)
);
create table public.debate_participants (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.debate_sessions on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  token_hash text not null unique, stance_id uuid, joined_at timestamptz not null default now(),
  foreign key (stance_id,session_id) references public.debate_stances(id,session_id)
);
create table public.staff_actions (
  id bigint generated always as identity primary key, staff_id uuid not null references public.teacher_profiles,
  action text not null, target_id uuid, created_at timestamptz not null default now()
);
create table public.rate_limits (bucket_key text primary key, count integer not null, expires_at timestamptz not null);

create index questions_teacher_status on public.questions(teacher_id,status,created_at desc);
create index questions_department_status on public.questions(department_id,status,created_at desc);
create index study_sessions_active on public.study_sessions(ends_at,programme,grade);
create index debate_participants_session on public.debate_participants(session_id);
create index debate_sessions_expiry on public.debate_sessions(expires_at);

create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.teacher_profiles where id=auth.uid() and active);
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.teacher_profiles where id=auth.uid() and active and role='admin');
$$;
create function public.can_read_question(p_teacher uuid,p_department uuid,p_type text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_admin() or (public.is_staff() and (
    p_teacher=auth.uid() or exists(select 1 from public.teacher_departments where teacher_id=auth.uid() and department_id=p_department)
    or (p_type='general' and exists(select 1 from public.teacher_profiles where id=auth.uid() and handles_general))
  ));
$$;

alter table public.departments enable row level security;
alter table public.subjects enable row level security;
alter table public.locations enable row level security;
alter table public.programme_grades enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.teacher_departments enable row level security;
alter table public.questions enable row level security;
alter table public.public_boards enable row level security;
alter table public.board_questions enable row level security;
alter table public.study_sessions enable row level security;
alter table public.debate_sessions enable row level security;
alter table public.debate_stances enable row level security;
alter table public.debate_participants enable row level security;
alter table public.staff_actions enable row level security;
alter table public.rate_limits enable row level security;

-- Reset Supabase's default table privileges: every grant below is intentional.
revoke all on public.departments,public.subjects,public.locations,public.programme_grades,public.teacher_profiles,
  public.teacher_departments,public.questions,public.public_boards,public.board_questions,public.study_sessions,
  public.debate_sessions,public.debate_stances,public.debate_participants,public.staff_actions,public.rate_limits from anon,authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
grant select on public.departments,public.subjects,public.locations,public.programme_grades,public.public_boards to anon,authenticated;
grant select on public.teacher_profiles,public.teacher_departments,public.questions,public.board_questions,
  public.debate_sessions,public.debate_stances,public.debate_participants,public.staff_actions to authenticated;

create policy directory_read on public.departments for select to anon,authenticated using(true);
create policy directory_read on public.subjects for select to anon,authenticated using(true);
create policy directory_read on public.locations for select to anon,authenticated using(true);
create policy directory_read on public.programme_grades for select to anon,authenticated using(true);
create policy staff_profile_read on public.teacher_profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy staff_memberships_read on public.teacher_departments for select to authenticated using(teacher_id=auth.uid() or public.is_admin());
create policy staff_questions_read on public.questions for select to authenticated using(public.can_read_question(teacher_id,department_id,recipient_type));
create policy boards_read on public.public_boards for select to anon,authenticated using(true);
create policy board_publications_staff_read on public.board_questions for select to authenticated using(public.is_staff());
create policy debate_owner_read on public.debate_sessions for select to authenticated using(public.is_staff() and teacher_id=auth.uid());
create policy stance_owner_read on public.debate_stances for select to authenticated using(exists(select 1 from public.debate_sessions where id=session_id and teacher_id=auth.uid()) and public.is_staff());
create policy participant_owner_read on public.debate_participants for select to authenticated using(exists(select 1 from public.debate_sessions where id=session_id and teacher_id=auth.uid()) and public.is_staff());
create policy audit_admin_read on public.staff_actions for select to authenticated using(public.is_admin());

-- These public projection views deliberately expose only selected columns.
create view public.teacher_directory as select id,display_name from public.teacher_profiles where active;
create view public.active_study_sessions as
  select s.id,s.programme,s.grade,s.subject_id,s.focus,s.location_id,s.custom_location,s.starts_at,s.ends_at,
    s.open_spots,s.host_name,s.contact,s.created_at, jsonb_build_object('name',sub.name) as subject,
    jsonb_build_object('name',loc.name) as location
  from public.study_sessions s join public.subjects sub on sub.id=s.subject_id join public.locations loc on loc.id=s.location_id
  where s.cancelled_at is null and s.ends_at > now();
create view public.published_questions as
  select b.slug,b.title,q.id,q.body,q.status,bq.published_at from public.board_questions bq
  join public.public_boards b on b.id=bq.board_id join public.questions q on q.id=bq.question_id
  where q.moderation_status='approved' and q.status <> 'archived';
grant select on public.teacher_directory,public.active_study_sessions,public.published_questions to anon,authenticated;

create function public.mutate_question(p_staff uuid,p_question uuid,p_action text,p_board uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare q public.questions; actor public.teacher_profiles;
begin
  select * into actor from public.teacher_profiles where id=p_staff and active;
  if not found then raise exception 'Teacher unavailable'; end if;
  select * into q from public.questions where id=p_question for update;
  if not found then raise exception 'Question unavailable'; end if;
  if (actor.role='admin' or q.teacher_id=p_staff or
    (q.recipient_type='general' and actor.handles_general) or
    exists(select 1 from public.teacher_departments where teacher_id=p_staff and department_id=q.department_id)) is not true then
    raise exception 'Question unavailable';
  end if;
  if p_action in ('pin','unpin') then
    if not exists(select 1 from public.public_boards where id=p_board and owner_id=p_staff) then raise exception 'Choose one of your boards'; end if;
    if p_action='pin' then
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
create function public.consume_rate_limit(p_key text,p_max integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare result integer;
begin
  insert into public.rate_limits(bucket_key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
  on conflict(bucket_key) do update set
    count=case when rate_limits.expires_at<=now() then 1 else rate_limits.count+1 end,
    expires_at=case when rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else rate_limits.expires_at end
  returning count into result;
  return result<=p_max;
end;
$$;

create function public.create_debate(p_teacher uuid,p_prompt text,p_stances text[],p_seconds integer,p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare session_id uuid; stance text; i integer:=0;
begin
  if coalesce(array_length(p_stances,1),0) not between 2 and 4 then raise exception 'A debate needs 2–4 stances'; end if;
  if (select count(distinct lower(trim(s))) from unnest(p_stances) s) <> array_length(p_stances,1) then raise exception 'Stance names must be distinct'; end if;
  if not exists(select 1 from public.teacher_profiles where id=p_teacher and active) then raise exception 'Teacher unavailable'; end if;
  insert into public.debate_sessions(teacher_id,prompt,prep_seconds,join_code,timer_remaining)
    values(p_teacher,p_prompt,p_seconds,p_code,p_seconds) returning id into session_id;
  foreach stance in array p_stances loop
    insert into public.debate_stances(session_id,label,position) values(session_id,stance,i); i:=i+1;
  end loop;
  return session_id;
end;
$$;

create function public.join_debate(p_code text,p_name text,p_token_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.debate_sessions; participant_id uuid;
begin
  select * into s from public.debate_sessions where join_code=p_code for update;
  if not found or s.expires_at<=now() then raise exception 'Lobby not found or expired'; end if;
  if s.status<>'lobby' then raise exception 'This lobby is closed to new participants'; end if;
  if (select count(*) from public.debate_participants where session_id=s.id)>=100 then raise exception 'Lobby is full'; end if;
  insert into public.debate_participants(session_id,display_name,token_hash) values(s.id,p_name,p_token_hash) returning id into participant_id;
  return participant_id;
end;
$$;

create function public.assign_debate(p_session uuid,p_teacher uuid,p_assignments jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s public.debate_sessions; n integer; k integer;
begin
  select * into s from public.debate_sessions where id=p_session and teacher_id=p_teacher for update;
  if not found or s.expires_at<=now() then raise exception 'Session unavailable'; end if;
  if s.status<>'lobby' then raise exception 'Stances already assigned'; end if;
  select count(*) into n from public.debate_participants where session_id=s.id;
  select count(*) into k from public.debate_stances where session_id=s.id;
  if n=0 then raise exception 'Add participants first'; end if;
  -- A concurrent join changes the roster; reject stale assignments and let the server retry.
  if jsonb_array_length(p_assignments)<>n or
    (select count(distinct (a->>'participantId')) from jsonb_array_elements(p_assignments) a)<>n or
    exists(select 1 from jsonb_array_elements(p_assignments) a where
      not exists(select 1 from public.debate_participants where id=(a->>'participantId')::uuid and session_id=s.id)
      or not exists(select 1 from public.debate_stances where id=(a->>'stanceId')::uuid and session_id=s.id)) then
    raise exception 'Roster changed; retry assignment';
  end if;
  if exists(select 1 from public.debate_stances st where st.session_id=s.id and
    (select count(*) from jsonb_array_elements(p_assignments) a where (a->>'stanceId')::uuid=st.id) not between n/k and (n+k-1)/k) then
    raise exception 'Assignments must be balanced';
  end if;
  update public.debate_participants p set stance_id=(a->>'stanceId')::uuid
    from jsonb_array_elements(p_assignments) a where p.id=(a->>'participantId')::uuid and p.session_id=s.id;
  update public.debate_sessions set status='assigned',timer_deadline=null,timer_remaining=prep_seconds where id=s.id;
end;
$$;

create function public.remove_debate_participant(p_session uuid,p_teacher uuid,p_participant uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.debate_sessions;
begin
  select * into s from public.debate_sessions where id=p_session and teacher_id=p_teacher for update;
  if not found or s.expires_at<=now() or s.status<>'lobby' then raise exception 'Reopen the lobby before removing participants'; end if;
  delete from public.debate_participants where session_id=s.id and id=p_participant;
end;
$$;
create function public.update_teacher_access(p_teacher uuid,p_general boolean,p_departments uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.teacher_profiles set handles_general=p_general where id=p_teacher;
  if not found then raise exception 'Teacher not found'; end if;
  delete from public.teacher_departments where teacher_id=p_teacher;
  insert into public.teacher_departments(teacher_id,department_id) select p_teacher,unnest(p_departments);
end;
$$;
create function public.control_debate(p_session uuid,p_teacher uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.debate_sessions; seconds_left integer;
begin
  select * into s from public.debate_sessions where id=p_session and teacher_id=p_teacher for update;
  if not found or s.expires_at<=now() or s.status='ended' then raise exception 'Session unavailable'; end if;
  if p_action='end' then
    update public.debate_sessions set status='ended',timer_deadline=null where id=s.id;
  elsif p_action='reopen' then
    update public.debate_participants set stance_id=null where session_id=s.id;
    update public.debate_sessions set status='lobby',timer_deadline=null,timer_remaining=prep_seconds where id=s.id;
  elsif p_action='remove' then raise exception 'Use remove_participant';
  elsif s.status<>'assigned' then raise exception 'Assign stances before starting preparation';
  elsif p_action='start' then
    if s.timer_deadline is null then
      update public.debate_sessions set timer_deadline=now()+make_interval(secs=>coalesce(timer_remaining,prep_seconds)),timer_remaining=null where id=s.id;
    end if;
  elsif p_action='pause' then
    if s.timer_deadline is not null then
      seconds_left:=greatest(0,ceil(extract(epoch from s.timer_deadline-now()))::integer);
      update public.debate_sessions set timer_remaining=seconds_left,timer_deadline=null where id=s.id;
    end if;
  elsif p_action='reset' then
    update public.debate_sessions set timer_remaining=prep_seconds,timer_deadline=null where id=s.id;
  else raise exception 'Unknown action'; end if;
end;
$$;

-- Privileged RPCs must only be reachable with a server-side service key.
revoke all on function public.consume_rate_limit(text,integer,integer),public.create_debate(uuid,text,text[],integer,text),
  public.join_debate(text,text,text),public.assign_debate(uuid,uuid,jsonb),public.control_debate(uuid,uuid,text),
  public.remove_debate_participant(uuid,uuid,uuid),public.update_teacher_access(uuid,boolean,uuid[]),
  public.mutate_question(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.create_debate(uuid,text,text[],integer,text),
  public.join_debate(text,text,text),public.assign_debate(uuid,uuid,jsonb),public.control_debate(uuid,uuid,text),
  public.remove_debate_participant(uuid,uuid,uuid),public.update_teacher_access(uuid,boolean,uuid[]),
  public.mutate_question(uuid,uuid,text,uuid) to service_role;
revoke all on function public.is_staff(),public.is_admin(),public.can_read_question(uuid,uuid,text) from public;
grant execute on function public.is_staff(),public.is_admin(),public.can_read_question(uuid,uuid,text) to authenticated;

insert into public.departments(id,name) values
  ('10000000-0000-4000-8000-000000000001','Mathematics'),('10000000-0000-4000-8000-000000000002','Natural Sciences'),
  ('10000000-0000-4000-8000-000000000003','Humanities'),('10000000-0000-4000-8000-000000000004','Languages'),
  ('10000000-0000-4000-8000-000000000005','Arts & Design');
insert into public.subjects(name,department_id) values
  ('Mathematics','10000000-0000-4000-8000-000000000001'),('Physics','10000000-0000-4000-8000-000000000002'),
  ('Biology','10000000-0000-4000-8000-000000000002'),('Chemistry','10000000-0000-4000-8000-000000000002'),
  ('History','10000000-0000-4000-8000-000000000003'),('Geography','10000000-0000-4000-8000-000000000003'),
  ('Economics','10000000-0000-4000-8000-000000000003'),('English','10000000-0000-4000-8000-000000000004'),
  ('Polish','10000000-0000-4000-8000-000000000004'),('Computer Science','10000000-0000-4000-8000-000000000002'),
  ('Visual Arts','10000000-0000-4000-8000-000000000005'),('Theory of Knowledge','10000000-0000-4000-8000-000000000003');
insert into public.locations(name) values('Library'),('Study Hall'),('Room 102'),('Cafeteria'),('Courtyard'),('Other');
insert into public.programme_grades values('MYP','MYP 1'),('MYP','MYP 2'),('MYP','MYP 3'),('MYP','MYP 4'),('MYP','MYP 5'),
  ('DP','Grade I'),('DP','Grade II'),('National Curriculum','Grade I'),('National Curriculum','Grade II'),
  ('National Curriculum','Grade III'),('National Curriculum','Grade IV');

alter publication supabase_realtime add table public.debate_sessions,public.debate_participants,public.debate_stances,public.questions;
commit;

-- Optional cleanup: enable Supabase Cron in Integrations, then run:
-- select cron.schedule('schoolhub-cleanup','0 * * * *',$$
--   delete from public.debate_sessions where expires_at < now();
--   delete from public.rate_limits where expires_at < now();
--   delete from public.study_sessions where ends_at < now() - interval '7 days';
-- $$);
