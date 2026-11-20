# Background jobs

All in [`supabase/functions/`](../supabase/functions) (Supabase Edge Functions, Deno + TypeScript). Every run is recorded in `sync_runs`.

| Function | Trigger | What it does | Secrets | Status |
|---|---|---|---|---|
| `meta-sync` | Every **30 min** (`?days=3`); nightly `?days=37` backfill | All visible ad accounts; then, for accounts linked to Active/New clients, campaigns → ad sets → ads + creatives (incl. text kept in the post spec / asset feed) → daily ad-level insights, 4 accounts at a time. | `META_SYSTEM_USER_TOKEN` | Live (9 Nov) |
| `retool-bridge` | Every **15 min** | Copies employees, clients (+ ads manager), ad account links, onboarding, campaign specifics, sheet leads, website requests, GHL custom field names, templates and Ad Preview history from Retool, read-only ([retool-bridge.md](retool-bridge.md)) | `RETOOL_DB_URL` | Live (9 Nov) |
| `run-rules` | `10,40 * * * *` | Suggestion rules on the last 7 days → `suggestions`; resolves cleared ones; reopens expired snoozes; **checks in advance whether Meta would let The Lab pause each suggested ad** (validate only) → `turn_off_check` ([suggestions.md](suggestions.md)) | `META_SYSTEM_USER_TOKEN` | Live (10 Nov; check since 12 Nov) |
| `meta-action` | App: **Turn off** / **Undo** on Today (signed-in staff) | Checks access, re-reads the ad, pauses (or turns back on), reads it back to confirm, logs to `actions_log` with Meta's full answer | `META_SYSTEM_USER_TOKEN` | Live |
| `meta-check` | On demand (cron secret): `select private.call_function('meta-check', '?…')`, read `net._http_response` | Diagnostics, never returns the token: token permissions and editable vs view-only accounts; `?ad=<id>` why an ad can't be paused; `?ads=<ids>` validate-only pause for many ads + visible Pages; `?adsets=<ids>`; `?forms=<pageId>` can lead forms be read | `META_SYSTEM_USER_TOKEN` | Live |
| `ad-check` | App: **Submit** and **Full check** on an ad (signed-in staff) | Built-in mistake checks (no AI) on the copy, then, if the Claude key is set, Claude reads copy, image text and video stills; saves findings ([ad-approval.md](ad-approval.md)) | `ANTHROPIC_API_KEY` (optional) | Live; Claude part waits for the key |
| `approval-notify` | Database trigger on `ad_review_events` (status changes of Lab ads) | Posts Retool-style messages in #mrkd-internal-app, tagging the reviewer or the ad's creator ([ad-approval.md](ad-approval.md#slack-messages)) | `SLACK_APPROVALS_WEBHOOK_URL` | Built; skips until the webhook is added |
| `prospects-action` | When an owner searches GHL or adds someone on Prospects | Owners only (or the cron secret): search MRKD's GHL contacts, add one with its chat ([prospects.md](prospects.md)) | `GHL_PRIVATE_TOKEN`, `TYPESAFE_API_KEY` | Live (20 Nov) |
| `prospects-sync` | Every 30 min at **:05** and **:35** | Owners-only Prospects: GHL chats (last 120 days), messages, sales pipelines; Jev suggests type and temperature ([prospects.md](prospects.md)) | `GHL_PRIVATE_TOKEN`, `TYPESAFE_API_KEY` | Live (19 Nov) |
| `tag-creatives` | Hourly at **:50** | Jev (TypeSafe) tags each new ad creative: offer, audience, hook, 4 yes/no tags ([creative-tags.md](creative-tags.md)) | `TYPESAFE_API_KEY` | Live (11 Nov) |
| `ghl-sync` | Hourly at **:25** | Reads MRKD's GHL sub-account directly, read-only: users and each client's contact (status, client ID, assigned to) → `ghl_*_live`; adds GHL-only clients; client status and ads manager follow GHL; counts differences with the Retool copy ([ghl.md](ghl.md)) | `GHL_PRIVATE_TOKEN` | Live (status from GHL since 19 Nov) |
| `site-check` | On demand (cron secret) | Opens each active client's website home page: what it's built on, basic SEO signals ([seo.md](seo.md)) | none | Built (13 Nov) |

Not a background job: **Ad Studio** renders ads in the browser (Pyodide) from kit files in `style_kit_files` ([ad-studio.md](ad-studio.md)).

Shared helpers: `_shared/supabase.ts` (service/user clients), `_shared/sync-log.ts` (records runs), `_shared/http.ts` (CORS, JSON, cron secret check). Meta API → table mapping is in `shared/meta/mapping.ts` (unit-tested).

## Secrets

Set in Supabase → Project Settings → Edge Functions → Secrets. **Never in the repo or chat.**

| Secret | Used by | Who provides |
|---|---|---|
| `META_SYSTEM_USER_TOKEN` | meta-sync, meta-action, run-rules, meta-check | Jordan/Trent (Business Manager System User MRKDPlatformTools; permissions in [setup/meta.md](setup/meta.md)) |
| `RETOOL_DB_URL` | retool-bridge | Jordan/Trent (Retool Database connection string) |
| `ANTHROPIC_API_KEY` | ad-check | MRKD's Anthropic account (optional; not added yet) |
| `CRON_SECRET` | all scheduled jobs | Any long random string; also used in the schedule below |
| `GHL_PRIVATE_TOKEN` | ghl-sync, prospects-sync | GHL private integration in MRKD's sub-account, view-only ([sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-ghl-read-only)) |
| `TYPESAFE_API_KEY` | tag-creatives, prospects-sync | TypeSafe AI console ([sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#add-the-typesafe-key-jev-ad-tagging)) |
| `SLACK_APPROVALS_WEBHOOK_URL` | approval-notify | Slack incoming webhook for #mrkd-internal-app ([sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-slack-ad-approval-messages)) |
| `APP_URL`, `GHL_LOCATION_ID`, `JEV_MODEL` | approval-notify, ghl-sync, tag-creatives | Optional overrides (defaults: the Lab's address, MRKD's GHL sub-account, `jev-latest`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Schedules

Live (migration 1200): `pg_cron` jobs call `private.call_function(name)`, which POSTs to the function with the `x-cron-secret` header. The secret is generated randomly, stored as the `CRON_SECRET` function secret **and** in Supabase Vault (`cron_secret`), and never written in the repo. The functions URL is in `app_settings.functions_base_url`.

| Job | Schedule | Status |
|---|---|---|
| `retool-bridge` | `*/15 * * * *` | Live |
| `meta-sync` (`?days=3`) | `*/30 * * * *` | Live |
| `meta-backfill` (`meta-sync?days=37`) | `20 7 * * *` (~2:20am Toronto) | Live |
| `run-rules` | `10,40 * * * *` | Live |
| `tag-creatives` | `50 * * * *` | Live |
| `prospects-sync` | `5,35 * * * *` | Live |
| `ghl-sync` | `25 * * * *` | Live |

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
