# Changelog

What changed, newest first. Every change to the platform adds a line here.

## 2026-11-10: Ad approval (Phase 2)
- **Ad approval is live** at `/approvals`, replacing Retool's Ad Preview: list with **Needs me / In progress / All / From Retool**, **New ad**, an editor for setup, creative, images and videos, lead form and notes, templates that fill in the client's details, a client info panel, the 11-point checklist, comments and history.
- **Check for mistakes** (`ad-check` function): Claude reads the copy, lead form, the text in images and the subtitles in videos (stills taken in the browser at upload; no audio), compares against the client's details, and lists issues with a suggested fix. **Fixed** / **Ignore** per issue; ignored issues stay ignored next time. The checklist shows the AI's opinion next to the items it can judge. Waiting on the Claude key (`ANTHROPIC_API_KEY`); until then it says it isn't set up.
- **"Hey, just double checking"**: submitting with open issues lists them with **Go back and fix** or **Submit anyway**; submitting anyway is recorded.
- Status changes only through `set_review_status` (migration 2100): no skipping review, history of every move, reviewer defaults to the client's ads manager.
- Retool's Ad Preview history (596 ads), templates (13 creative, 8 lead form) and GHL custom field names are now copied read-only every 15 minutes (migration 2200). Retool's base64 images are not copied.
- Not yet: Slack and ClickUp notifications for ad approval.
- Meta sync now retries Meta's temporary errors ("Service temporarily unavailable") instead of failing that account for the run.
- Status update for the morning: [docs/updates/2026-11-10-overnight.md](docs/updates/2026-11-10-overnight.md).

## 2026-11-10: Settings screen
- New **Settings** page: owners and admins change suggestion thresholds (CPL, no-lead spend, budget hog, CTR, link CTR, minimum impressions, no-recent-leads days). Values are checked and every change is logged with who and when (migration 2000). Staff see them read-only.
- Settings also lets anyone switch between the four designs on real data, and links to Sync status. On phones, Settings replaces Sync in the bottom bar.

## 2026-11-10: SOPs
- Added [docs/sop/](docs/sop/README.md): step-by-step procedures for ads managers (signing in, daily account check, acting on suggestions, submitting and reviewing ads) and for owners/admins (staff and access, new client or ad account, thresholds, tokens and secrets, weekly health check, troubleshooting).

## 2026-11-10: Clear Turn off feedback
- Found that a first Turn off attempt ran on an outdated copy of the page (from before the real Turn off), so nothing reached Meta. Added an **"The Lab was updated. Reload"** bar when a newer version is live.
- Turn off now confirms with "Done: … is now off in Meta" plus a link to check in Ads Manager, and a **Recently turned off** list shows every attempt with who, when and the result (migration 1900 links log entries to ads).

## 2026-11-10: No more refreshing
- Insights, Suggestions and Sync status reload by themselves when new data lands (Supabase Realtime on `sync_runs`, migration 1800), and when you come back to a tab after 5+ minutes.

## 2026-11-10: One-click Turn off
- `run-rules` now saves suggestions every 30 minutes (first run: 38; Adam 16, Jordan 13, Zohirul 9). Each ads manager sees only theirs.
- **Turn off** pauses the ad in Meta (confirmation first; re-checks the ad; logs who did it). Works on the 32 accounts where the system user has Manage campaigns; on view-only accounts it explains what to change and links to Ads Manager.
- **Not now** (24 h) and **Dismiss** (7 days) are saved.
- Added a `meta-check` diagnostic: the Meta token already had `ads_management`.

## 2026-11-10: Suggestion rules tuned on real data
- Budget hog now needs no leads or CPL over $80 (it was flagging 2 leads at $35). Migration 1600 retires the old "max leads" setting.
- Percent values show 3 decimals when 2 would look equal to the threshold (0.497%, not "0.50% (under 0.50%)").
- On 10 Nov data: 42 suggestions before the change across 3 ads managers.

## 2026-11-10: Suggestions on live data
- The Suggestions page runs on real numbers. Until one-click pausing is built (needs the `ads_management` scope and the meta-action function), "Turn off" opens the ad in Ads Manager instead, so nothing looks paused when it isn't.

## 2026-11-10: Dashboard speed fix
- Signed-in reports were timing out (8 s limit) because access checks ran once per row. Migration 1500 makes them run once per query: account view 8.1 s → 0.18 s, all views under 0.6 s. Same access rules; tests pass.
- First real sign-in worked (Jordan, by email link) and linked to the staff record.

## 2026-11-10: The Lab is online
- Cloudflare Pages deploys the app at https://sitebuilder-6iw.pages.dev on every push. Supabase sign-in redirects now point there (email sign-in link works; Google sign-in once its OAuth client is set up).

## 2026-11-09: Named "The Lab"
- Sign-in screen, browser tab and top bar now say The Lab; Google sign-in setup uses the same name.

## 2026-11-09: Sign-in and hosting setup
- Sign-in screen: Continue with Google (restricted to @mrkd.ca) plus an email sign-in link; "not on the staff list" screen; sign out from the top bar. Migration 1400 links each login to the staff record by email (tested).
- App now builds against the live Supabase project (`web/.env.production`, public values only), with `_redirects` and `.nvmrc` for Cloudflare Pages. Build settings and Google OAuth steps in [docs/setup/hosting-and-signin.md](docs/setup/hosting-and-signin.md).

## 2026-11-09: Meta sync covers 46 accounts
- After the missing ad accounts were assigned to the system user, 46 of the active client accounts sync (2,610 campaigns, 6,876 ads, 37 days of daily numbers, about 85 seconds per full run). Still missing: Bulls Brazilian Jiu-Jitsu, Infinite Hitting Deerfield Beach, Gracie Barra Whiterock (not assigned/shared) and Campeao (no longer a client but still Active in GHL/Retool).
- meta-sync now retries with smaller batches when Meta says "reduce the amount of data" (fixed Atlantic MMA).

## 2026-11-09: Meta sync live
- Meta app and system user token set up (never expires, read-only scopes), stored as a Supabase secret.
- `meta-sync` finished and deployed: all visible ad accounts, then campaigns, ad sets, ads, creatives and daily ad-level insights for accounts linked to Active/New clients, 4 at a time; token only in the request header. Scheduled every 30 min plus a nightly 37-day backfill (migration 1300).
- First run: the system user could see 12 of the 50 active client ad accounts; the other 38 need assigning to it in Business Manager. Fixed duplicate creatives/rows found on the first run.

## 2026-11-09: Meta setup spec
- Full Meta app + system user token specification (app type, product, mode, access level, token type and expiry, exact scopes now vs later, asset permissions, steps, troubleshooting) in [docs/setup/meta.md](docs/setup/meta.md). System user `MRKDPlatformTools` created with View performance on ad accounts and Leads on Pages; app creation blocked by Facebook's new-device check.

## 2026-11-09: Retool bridge live
- Real data now copies from Retool every 15 minutes (read-only): 6 staff, 221 clients with their GHL ads manager, 188 ad accounts (132 linked to clients), 63,242 lead-sheet rows, onboarding, campaign specifics, website requests. First run: 5 seconds, no errors.
- Bridge runs inside the database over `dblink` (migration 1100), triggered by `pg_cron` (migration 1200) through the deployed `retool-bridge` function; cron secret generated and stored in Supabase secrets and Vault.
- New tests against a fake Retool database; fixed a duplicate-email case the test found.

## 2026-11-09: Supabase live
- Supabase project created (Canada Central) and the database installed: all 10 migrations applied and verified on the live project (36 tables, security on every table, 84 access rules, private file bucket, thresholds and checklist loaded).
- Added migration 1000 (hardening) after running Supabase's security advisor; remaining 4 warnings are intended and documented.
- Claude's Supabase access token is stored encrypted in a dedicated cloud environment, not in chat or the repo.

## 2026-11-09: Claude connector planned
- Added Phase 1c: an MRKD connector so employees can ask Claude about their accounts with their own login ([docs/claude-connector.md](docs/claude-connector.md)).

## 2026-11-09: Simpler style
- Removed every emoji from the app (KPI tiles, messages) and the docs. Plain labels throughout; style rule added to the development guide.

## 2026-11-09: Suggestions per employee + design options
- **Suggestions are per ads manager:** staff see and act on only the accounts assigned to them in GHL; owners/admins see everyone's with a filter. Enforced in the database (migration 0900) and tested; reassigning a client in GHL moves its open suggestions to the new manager.
- Insights opens on the ads manager's own accounts the first time.
- App knows who's signed in (`me()`), with initials in the top bar. Sample mode has a **"Viewing as"** switch to try it as different people.
- **Four design options** (A Classic, B Midnight, C MRKD Bold with sidebar, D Compact), switchable from the yellow bar or `?design=`; screenshots in [docs/design-options.md](docs/design-options.md). All colours are now design tokens.
- Fonts bundled with the app instead of Google Fonts.

## 2026-11-09: Skeleton build (Phase 0 groundwork, before accounts exist)

**App (`web/`)**
- React + TypeScript + Tailwind app with routes: Insights, Suggestions, Ad approval (placeholder), Search, Sync status. Top nav on desktop, bottom tab bar on phones.
- **Meta insights** screen with sample data: 8 KPI tiles with previous-period comparison, ads manager filter, date presets + custom range, Accounts / Campaigns / Ad sets / Ads / Leads tabs with counts, sortable tables (desktop) and cards (phone), account selection that filters KPIs and tabs, creative popup, Ads Manager links, CSV export, search.
- **Suggestions** preview: rules run on sample data, one card per ad account, Turn off / Not now / Dismiss (no changes sent anywhere in sample mode).
- **Search** for lead forms and ad copy. **Sync status** list.
- Sample data mode (fictional gyms, fixed seed) when Supabase isn't configured.

**Shared logic (`shared/`)**
- KPI formulas matching Retool, date presets in Toronto time, suggestion rules engine with the agreed thresholds, Meta API → table mapping. 44 unit tests.

**Database (`supabase/`)**
- 8 migrations: foundation (staff, clients, lookups, sync log, audit log), Meta tables with typed daily insights, Retool bridge tables, suggestions + thresholds, ad approval tables (reviews, assets, AI findings, checklist, comments, events, templates), reporting functions, row-level security on every table, private file bucket.
- Fictional seed data; database tests for report numbers and permissions (run on real Postgres).
- Background job skeletons: meta-sync, retool-bridge, run-rules, meta-action, ad-check.

**Docs**
- Documentation map, architecture, data model, KPI formulas, suggestions, ad approval, background jobs, Retool bridge, auth, development guide, account setup steps, decision log, insights screen.

## 2026-11-09: Plan agreed
- Focus on Meta insights + ad approval first; Clients View, Onboarding and LeadLabz stay in Retool (read via the Retool bridge).
- Suggestion thresholds agreed. Ad approval: manual uploads, AI check of copy / image text / video subtitles, "Hey, just double checking" soft warning; no audio check; suggestions in-app only.
- Hosting: Cloudflare Pages + Supabase; app embedded in GHL with GHL single sign-on.

## 2026-11-08: Retool audit
- Exported and documented all 47 Retool apps, 32 workflows and the database ([current-system.md](docs/current-system.md), [feature-checklist.md](docs/feature-checklist.md)).
