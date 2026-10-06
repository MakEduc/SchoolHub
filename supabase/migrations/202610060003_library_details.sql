-- Grades are independent of programme. Keep previous sessions and private links.
begin;
insert into public.programme_grades(programme,grade)
select p,g from unnest(array['IB','National']) p
cross join unnest(array['Grade I','Grade II','Grade III','Grade IV']) g
on conflict do nothing;

-- Legacy MYP records remain historical; they are not shown on the new board.
update public.study_sessions set programme = 'IB' where programme = 'DP';
update public.study_sessions set programme = 'National' where programme = 'National Curriculum';
delete from public.programme_grades g where programme not in ('IB','National')
and not exists (select 1 from public.study_sessions s where s.programme=g.programme and s.grade=g.grade);

-- Existing preset locations become editable text without losing their names.
update public.study_sessions s set custom_location=l.name
from public.locations l where s.location_id=l.id and nullif(btrim(s.custom_location),'') is null;
alter table public.study_sessions add constraint study_meeting_place_required
check (char_length(btrim(custom_location)) between 1 and 80 and custom_location is not null);
-- Preserve legacy MYP rows, but require the new choices for every future write.
alter table public.study_sessions add constraint study_programme_grade_choices
check (programme in ('IB','National') and grade in ('Grade I','Grade II','Grade III','Grade IV')) not valid;
commit;
