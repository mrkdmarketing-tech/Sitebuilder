# Background jobs

All in [`supabase/functions/`](../supabase/functions) (Supabase Edge Functions, Deno + TypeScript). Every run is recorded in `sync_runs`.

| Function | Trigger | What it does | Status |
|---|---|---|---|
| `meta-sync` | Every **30 min** (pg_cron); nightly with `?days=37` to backfill | Ad accounts → campaigns → ad sets → creatives → ads → daily ad insights → leads, **each account independently** (one bad account can't stall the rest). Then triggers `run-rules`. | Skeleton: accounts + insights written; other steps TODO (Phase 1a) |
| `retool-bridge` | Every **15 min** | Copies employees, clients (+ ads manager), ad account links, onboarding, campaign specifics, sheet leads, website requests from Retool, read-only ([retool-bridge.md](retool-bridge.md)) | **Live** (9 Nov 2026) |
| `run-rules` | After each `meta-sync` | Evaluates suggestion rules and updates `suggestions` ([suggestions.md](suggestions.md)) | Skeleton (Phase 1b) |
| `meta-action` | App button ("Turn off") | Pauses an ad in Meta with safety checks + audit log | Skeleton (Phase 1b) |
| `ad-check` | App, on upload in ad approval | AI quality check with Claude ([ad-approval.md](ad-approval.md)) | Skeleton (Phase 2) |

Shared helpers: `_shared/supabase.ts` (service/user clients), `_shared/sync-log.ts` (records runs), `_shared/http.ts` (CORS, JSON, cron secret check). Meta API → table mapping is in `shared/meta/mapping.ts` (unit-tested).

## Secrets

Set in Supabase → Project Settings → Edge Functions → Secrets. **Never in the repo or chat.**

| Secret | Used by | Who provides |
|---|---|---|
| `META_SYSTEM_USER_TOKEN` | meta-sync, meta-action | Jordan/Trent (Business Manager System User, `ads_read` + `ads_management`) |
| `RETOOL_DB_URL` | retool-bridge | Jordan/Trent (Retool Database connection string) |
| `ANTHROPIC_API_KEY` | ad-check | MRKD's Anthropic account (Phase 2) |
| `CRON_SECRET` | all scheduled jobs | Any long random string; also used in the schedule below |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Schedules

Live (migration 1200): `pg_cron` jobs call `private.call_function(name)`, which POSTs to the function with the `x-cron-secret` header. The secret is generated randomly, stored as the `CRON_SECRET` function secret **and** in Supabase Vault (`cron_secret`), and never written in the repo. The functions URL is in `app_settings.functions_base_url`.

| Job | Schedule | Status |
|---|---|---|
| `retool-bridge` | `*/15 * * * *` | Live |
| `meta-sync` | `*/30 * * * *` | Phase 1a |
| `meta-backfill` (`meta-sync?days=37`) | nightly | Phase 1a |

Check them with `select jobname, schedule, active from cron.job;` and recent calls with `select * from net._http_response order by id desc limit 5;`.

For reference, the raw form without the helper:

```sql
select cron.schedule('meta-sync', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/meta-sync',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
  ) $$);
select cron.schedule('retool-bridge', '*/15 * * * *', $$ … same, /retool-bridge … $$);
select cron.schedule('meta-backfill', '15 7 * * *', $$ … /meta-sync?days=37 … $$);  -- ~2–3am Toronto
```

(The real values go in via the Supabase SQL editor, not a migration, because they contain the secret.)

## Meta API notes

- Graph API version is set in one constant in `meta-sync`. Retool hard-coded v20.0; set it to Meta's current version when Phase 1a starts.
- Insights are pulled at **ad level, one row per day** (`time_increment=1`) for the last 3 days every run (Meta revises recent days), plus a nightly 37-day backfill.
- Rate limits: accounts are processed one at a time; failures are logged per account and the run is marked `partial`.

## Sync status screen

`/status` in the app lists recent runs (job, time, rows, errors). If a job fails repeatedly, that's where it shows first.

## Deploying

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest functions deploy <name> --remote=mhayvuxqrlwyvalceerw --use-api
```

`--use-api` bundles on Supabase's side (no Docker needed). Per-function settings (whether Supabase checks the caller's login) are in [`supabase/config.toml`](../supabase/config.toml): scheduled jobs check `CRON_SECRET` themselves; functions called from the app keep Supabase's login check. Claude deploys with the access token stored in its cloud environment ([setup/accounts.md](setup/accounts.md#progress)).
