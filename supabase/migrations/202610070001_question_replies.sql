-- Apply after the existing SchoolHub migrations. Existing questions stay private.
begin;
alter table public.questions add column visibility text not null default 'private' check (visibility in ('private','public'));
alter table public.questions add column receipt_token_hash text;
alter table public.questions add column answer text check (char_length(answer) between 1 and 2000);
create unique index questions_receipt_token on public.questions(receipt_token_hash) where receipt_token_hash is not null;
create index questions_public_feed on public.questions(created_at desc) where visibility='public' and moderation_status='approved' and status<>'archived';
create view public.public_questions as
  select id,body,status,created_at,answer,answered_at from public.questions
  where visibility='public' and moderation_status='approved' and status<>'archived';
create or replace view public.published_questions as
  select b.slug,b.title,q.id,q.body,q.status,bq.published_at,q.answer,q.answered_at from public.board_questions bq
  join public.public_boards b on b.id=bq.board_id join public.questions q on q.id=bq.question_id
  where q.visibility='public' and q.moderation_status='approved' and q.status<>'archived';
grant select on public.public_questions,public.published_questions to anon,authenticated;
create or replace function public.mutate_question(p_staff uuid,p_question uuid,p_action text,p_board uuid default null) returns void
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

create function public.answer_question(p_staff uuid,p_question uuid,p_answer text) returns void
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
  if q.status='archived' then raise exception 'Restore this question before answering'; end if;
  if p_answer is null or char_length(btrim(p_answer)) not between 1 and 2000 then raise exception 'Write an answer of 1-2000 characters'; end if;
  update public.questions set answer=btrim(p_answer),status='answered',answered_at=now() where id=q.id;
  insert into public.staff_actions(staff_id,action,target_id) values(p_staff,'question.answer',q.id);
end;
$$;
revoke all on function public.answer_question(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.answer_question(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
