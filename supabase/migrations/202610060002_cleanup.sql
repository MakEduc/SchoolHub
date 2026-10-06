-- Apply after the main migration. Supabase Cron is available as the pg_cron extension.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('schoolhub-cleanup','0 * * * *',$$
  delete from public.debate_sessions where expires_at < now();
  delete from public.rate_limits where expires_at < now();
  delete from public.study_sessions where ends_at < now() - interval '7 days';
$$);
