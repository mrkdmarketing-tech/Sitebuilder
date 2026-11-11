# Background jobs

All in [`supabase/functions/`](../supabase/functions) (Supabase Edge Functions, Deno + TypeScript). Every run is recorded in `sync_runs`.

| Function | Trigger | What it does | Status |
|---|---|---|---|
| `meta-sync` | Every **30 min** (`?days=3`); nightly `?days=37` backfill | All visible ad accounts (name, status, currency); then, for accounts linked to Active/New clients, campaigns → ad sets → ads + creatives → daily ad-level insights, 4 accounts at a time, each independent. Deleted/archived ads that spent in the window get minimal rows so their numbers are kept. Token only in the Authorization header. | **Live** (9 Nov 2026). Leads list and `run-rules` trigger: next. |
| `retool-bridge` | Every **15 min** | Copies employees, clients (+ ads manager), ad account links, onboarding, campaign specifics, sheet leads, website requests, and (since 10 Nov) GHL custom field names, templates and Ad Preview history from Retool, read-only ([retool-bridge.md](retool-bridge.md)) | **Live** (9 Nov 2026) |
| `run-rules` | `10,40 * * * *` (10 min after each Meta sync) | Evaluates suggestion rules on the last 7 days and saves them to `suggestions`, stamped with the client's GHL ads manager; resolves ones that cleared; reopens expired snoozes ([suggestions.md](suggestions.md)) | **Live** (10 Nov 2026) |
| `meta-action` | App button ("Turn off"), signed-in staff only | Checks the caller may see the suggestion, re-reads the ad, pauses it in Meta, logs to `actions_log`, marks the suggestion done | **Live** (10 Nov 2026) |
| `meta-check` | On demand (`select private.call_function('meta-check')`, then read `net._http_response`) | Diagnostic: lists the Meta token's granted permissions and which ad accounts the system user can edit vs only view. Never returns the token. | Live |
| `ad-check` | App button "Check for mistakes", signed-in staff only | Reads the ad's copy, image previews and video frames plus the client's details, asks Claude for mistakes as strict JSON, saves findings and the checklist's AI column, records cost ([ad-approval.md](ad-approval.md#how-the-check-works-built-10-nov-2026)) | **Deployed** (10 Nov 2026). Answers "not set up yet" until `ANTHROPIC_API_KEY` is added. |

Shared helpers: `_shared/supabase.ts` (service/user clients), `_shared/sync-log.ts` (records runs), `_shared/http.ts` (CORS, JSON, cron secret check). Meta API → table mapping is in `shared/meta/mapping.ts` (unit-tested).

## Secrets

Set in Supabase → Project Settings → Edge Functions → Secrets. **Never in the repo or chat.**

| Secret | Used by | Who provides |
|---|---|---|
| `META_SYSTEM_USER_TOKEN` | meta-sync, meta-action | Jordan/Trent (Business Manager System User, `ads_read` + `ads_management`) |
| `RETOOL_DB_URL` | retool-bridge | Jordan/Trent (Retool Database connection string) |
| `ANTHROPIC_API_KEY` | ad-check | MRKD's Anthropic account (Phase 2) |
| `CRON_SECRET` | all scheduled jobs | Any long random string; also used in the schedule below |
| `SLACK_APPROVALS_WEBHOOK_URL` | approval-notify | Slack incoming webhook for #mrkd-internal-app ([sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-slack-ad-approval-messages)) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Schedules

Live (migration 1200): `pg_cron` jobs call `private.call_function(name)`, which POSTs to the function with the `x-cron-secret` header. The secret is generated randomly, stored as the `CRON_SECRET` function secret **and** in Supabase Vault (`cron_secret`), and never written in the repo. The functions URL is in `app_settings.functions_base_url`.

| Job | Schedule | Status |
|---|---|---|
| `retool-bridge` | `*/15 * * * *` | Live |
| `meta-sync` (`?days=3`) | `*/30 * * * *` | Live |
| `meta-backfill` (`meta-sync?days=37`) | `20 7 * * *` (~2:20am Toronto) | Live |
| `run-rules` | `10,40 * * * *` | Live |

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
- Rate limits: accounts are processed 4 at a time; failures are logged per account and the run is marked `partial`.
- Temporary Meta errors (code 2 "Service temporarily unavailable", code 1/99, bare 5xx) are retried up to 3 times with a short wait (added 10 Nov 2026, after they failed one random account most hours). "Reduce the amount of data" halves the page size instead.
- Insights are requested **one week at a time** (`weekWindows` in `meta-sync`), so the 37-day backfill is 6 requests per account. Added 11 Nov 2026: Atlantic MMA (752 ads) failed every time it was asked for 37 days at once.

## Sync status screen

`/status` in the app lists recent runs (job, time, rows, errors). If a job fails repeatedly, that's where it shows first.

## Deploying

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase@latest functions deploy <name> --remote=mhayvuxqrlwyvalceerw --use-api
```

`--use-api` bundles on Supabase's side (no Docker needed). Per-function settings (whether Supabase checks the caller's login) are in [`supabase/config.toml`](../supabase/config.toml): scheduled jobs check `CRON_SECRET` themselves; functions called from the app keep Supabase's login check. Claude deploys with the access token stored in its cloud environment ([setup/accounts.md](setup/accounts.md#progress)).
