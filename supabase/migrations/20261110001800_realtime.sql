-- =============================================================================
-- 1800 Live updates: open screens refresh when a background job finishes.
-- The app listens to changes on sync_runs (one small row per job run) through
-- Supabase Realtime. Row-level security still applies: only active staff
-- receive the events. docs/architecture.md#live-updates
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found, skipping';
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_runs'
  ) then
    alter publication supabase_realtime add table public.sync_runs;
  end if;
end $$;
