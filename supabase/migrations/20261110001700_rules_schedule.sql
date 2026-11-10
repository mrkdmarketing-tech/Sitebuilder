-- =============================================================================
-- 1700 Suggestions schedule: run-rules 10 minutes after each Meta sync
-- (meta-sync runs at :00 and :30). docs/suggestions.md
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron not available, skipping rules schedule';
    return;
  end if;
  perform cron.schedule('run-rules', '10,40 * * * *', 'select private.call_function(''run-rules'')');
end $$;

-- Who acted on a suggestion is shown in the app; nothing else changes.
create index if not exists suggestions_status_seen_idx on public.suggestions (status, last_seen_at desc);
