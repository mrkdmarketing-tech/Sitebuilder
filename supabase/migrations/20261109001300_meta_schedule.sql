-- =============================================================================
-- 1300 Meta sync schedule (docs/background-jobs.md#schedules).
--   meta-sync        every 30 min, last 3 days (Meta revises recent days)
--   meta-backfill    nightly 07:20 UTC (~2:20am Toronto), last 37 days
-- Skipped where pg_cron isn't available (local test harness).
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not available, skipping Meta schedules';
    return;
  end if;
  perform cron.schedule('meta-sync', '*/30 * * * *', 'select private.call_function(''meta-sync'', ''?days=3'')');
  perform cron.schedule('meta-backfill', '20 7 * * *', 'select private.call_function(''meta-sync'', ''?days=37'')');
end $$;
