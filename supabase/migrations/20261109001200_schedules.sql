-- =============================================================================
-- 1200 Schedules: pg_cron calls the background Edge Functions.
--
-- private.call_function(name) POSTs to the function with the shared secret
-- header (x-cron-secret, read from Vault secret 'cron_secret'). The project's
-- functions URL is in app_settings 'functions_base_url'.
-- Schedules (docs/background-jobs.md):
--   retool-bridge   every 15 min
--   (meta-sync, run-rules are added in Phase 1a/1b)
-- Skipped automatically where pg_cron / pg_net / Vault aren't available
-- (e.g. the local plain-Postgres test harness).
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise notice 'pg_cron / pg_net / vault not available, skipping schedules';
    return;
  end if;

  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;

  insert into public.app_settings (key, value)
  values ('functions_base_url', to_jsonb('https://mhayvuxqrlwyvalceerw.supabase.co/functions/v1'::text))
  on conflict (key) do nothing;

  execute $f$
    create or replace function private.call_function(p_name text, p_query text default '')
    returns bigint
    language sql
    security definer
    set search_path = public, extensions, pg_temp
    as $body$
      select net.http_post(
        url := (select value #>> '{}' from public.app_settings where key = 'functions_base_url') || '/' || p_name || p_query,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000)
    $body$
  $f$;
  revoke all on function private.call_function(text, text) from public, anon, authenticated;

  perform cron.schedule('retool-bridge', '*/15 * * * *', 'select private.call_function(''retool-bridge'')');
end $$;
