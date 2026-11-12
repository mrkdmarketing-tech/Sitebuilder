# Changelog

What changed, newest first. Every change to the platform adds a line here.

## 2026-11-12: Direct GHL connection (read-only, waiting for the token)
- New job `ghl-sync` reads MRKD's GHL sub-account directly: the team, and each client's contact (Client Status, Client ID, Assigned to). Hourly, view-only, never writes to GHL. Migration 3200.
- Runs alongside the Retool copy; `ghl_compare()` lists any differences (and marks values changed in The Lab). Once they match for a week, The Lab switches to GHL directly.
- Needs `GHL_PRIVATE_TOKEN` (private integration, view-only permissions): [steps](docs/sop/tokens-and-secrets.md#connect-ghl-read-only). Docs: [docs/ghl.md](docs/ghl.md).

## 2026-11-11: Today knows in advance when Turn off can't work
- `run-rules` now asks Meta every 30 minutes whether each suggested ad could be paused (validate only, nothing changes). Where Meta won't allow it, the row shows **Turn off in Ads Manager** and why ("This ad account is view-only for The Lab", "The Lab can't see this client's Facebook Page", "Meta says this ad account can't be changed") instead of a button that fails. Migration 3100; reasons in `shared/domain/metaErrors.ts` (tested).
- Today: 7 of 19 suggested ads can be turned off from The Lab. The rest need Meta access (docs/setup/meta.md).

## 2026-11-11: Sort Insights on the phone
- New **Sort** menu above the list on Insights (accounts, campaigns, ad sets, ads): spend, CPL, leads, CR or CPLC, low to high or high to low, or name. Works on the phone and desktop, stays in step with clicking a column heading, and is remembered.
- Cost sorts treat spend with no leads as the most expensive, so "CPL: high to low" puts those at the top instead of the bottom.

## 2026-11-11: What's working counts lead campaigns only
- Sales campaigns were mixed in, so "Seasonal" offers showed $179 a lead. That was almost all Jiu Jitsu FLO's Black Friday product sale (a Sales campaign aiming for purchases). The report now counts lead campaigns only (96% of spend). Migration 3000.

## 2026-11-11: What's working (Jev ad tagging)
- New tab **Insights → What's working**: cost per lead by offer (free trial, free week, seasonal...), audience (kids, adults, women...), opening hook (calls out a place, problem, benefit...) and image vs video, across every Active and New client. Green is cheaper than average, red dearer.
- Tags come from TypeSafe AI's **Jev** model, which reads each ad's headline and primary text (`tag-creatives`, hourly; migration 2800). Image vs video works already; the rest starts once the `TYPESAFE_API_KEY` secret is added ([steps](docs/sop/tokens-and-secrets.md#add-the-typesafe-key-jev-ad-tagging)). About 10 cents to tag all ~5,800 ads.
- Already visible without Jev: last 7 days, image ads $26.78 a lead vs video $39.11.
- Docs: [docs/creative-tags.md](docs/creative-tags.md).

## 2026-11-11: Why Turn off failed, and clearer messages
- Jordan's Turn offs this morning were refused by Meta. Checked all 28 suggested ads (validate only, nothing paused): 9 can be turned off, 11 are on view-only ad accounts, 7 are lead ads on Pages The Lab can't see (Meta calls this "Missing Lead Form"), 1 account isn't writable. Details and fixes: [docs/setup/meta.md](docs/setup/meta.md#checked-11-nov-2026-why-turn-off-failed).
- The failure message now says which access is missing and to turn it off in Ads Manager meanwhile. The log keeps Meta's full answer.
- `meta-check` can now test whether ads can be paused without pausing them.

## 2026-11-11: Turn off shows that it worked
- After **Turn off**, The Lab asks Meta for the ad's status again and shows a clear box: "Done: the ad is off. Meta confirms it's paused", with the time, **Undo**, **Check in Ads Manager** and **Done**. If it failed, the same box says why.
- The row stays on Today with a green tick ("Turned off, confirmed in Meta", time, Undo) instead of disappearing, and the count at the top goes down. `meta-action` updated and deployed (Undo is confirmed the same way).

## 2026-11-11: Ad approval: Slack messages
- Submitting an ad now posts in **#mrkd-internal-app**, like Retool did: "Ad for Review (NEW)" tagging the reviewer, with an **Open in The Lab** link. Sent back and approved ads tag whoever made them. Starts once the Slack webhook is added ([setup](docs/sop/tokens-and-secrets.md#connect-slack-ad-approval-messages)).
- **Jordan is the default reviewer** for submitted ads (pre-selected in the Submit box; can be changed per ad). Migration 2700, function `approval-notify` (deployed).

## 2026-11-11: Ad approval: mistakes flagged as you type, checked again on Submit
- New built-in checks (no AI, free, instant): the wrong discipline (Muay Thai in a jiu jitsu ad, or the other way round), a phone number or street address that isn't the client's, another location's name or city, a weekday that doesn't match the date, placeholders left in, common misspellings and repeated words. They show under each field as you type ([docs/ad-approval.md#built-in-checks](docs/ad-approval.md#built-in-checks)).
- **Submit** now saves, runs the full check, then shows "Hey, just double checking" if anything is open. No separate step to remember.
- Simpler form in Retool's order: images and videos, then primary text and headline, with the rest under **More**; ad type and booking after; lead form folded away.
- Tested against all 597 ads imported from Retool and on the real site build. Found a few clients whose address or phone on file doesn't match their ads (listed in the doc).
- `ad-check` updated and deployed: it runs the built-in checks on the server too, and they work without the Claude key.

## 2026-11-11: Today grouped by location
- Today now shows one block per location (client) with its items underneath, instead of one long mixed list. Locations with urgent items and the most money at stake come first. Each row shows what's wrong and, underneath, which ad.

## 2026-11-11: One-tap Dismiss on Today
- Every row on Today has an **X**: dismiss it without opening it (hidden for 7 days). The message that appears has **Undo**, which puts it straight back. Not now also has Undo.
- Tested on the real site build with real (exported) data before pushing.

## 2026-11-11: Fix: blank page after the Today update
- The Today page and its sidebar badge both opened a live-update connection with the same name; Supabase threw an error and the whole app stopped drawing (live site only, not sample data). Each connection now gets its own name, and a live-update failure can no longer break a page (`web/src/lib/useLiveRefresh.ts`).
- New safety net (`web/src/app/ErrorBoundary.tsx`): if a screen ever crashes, it shows "Something went wrong" with **Reload** instead of a blank page.

## 2026-11-11: Today
- New home page **Today**, replacing Suggestions: "6 things need you today. Your other 34 accounts are fine." then one quiet list, one row per item with one plain sentence and one button, most urgent and most money first. Tap a row for the numbers and other options. Count badge in the sidebar. Owners/admins switch between Everyone, Mine and each ads manager.
- **Turn off now works from any ad's row** (including low-click ones, from the row's details), and **Undo** turns an ad back on within 24 hours (from the message or the Recently turned off list). `meta-action` updated and deployed.
- SOP rewritten: [docs/sop/acting-on-suggestions.md](docs/sop/acting-on-suggestions.md).

## 2026-11-11: Fewer repeat sign-ins
- Sign-in emails now have a **6-digit code** as well as the link, and the sign-in screen asks for it. Typing the code signs in the app you're actually using. The link could sign in a different browser (on iPhones the home-screen app and Safari don't share sign-ins), which is why people kept being asked to sign in again.
- Clearer message when the email limit (2 per hour across MRKD, Supabase's built-in sender) is hit. Google sign-in removes that limit.

## 2026-11-11: Two-step sign-in
- **Owners and admins now confirm each sign-in with a 6-digit code** from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password). First sign-in after this: scan a QR code to set it up. Staff can turn it on in Settings.
- The database enforces it: without the code, owner/admin actions (roles, team, clients, thresholds, everyone's suggestions) are refused (migration 2600).
- Settings → Staff shows who has it on; owners/admins can **Reset two-step** for someone who lost their phone. Settings → Two-step sign-in: turn on, or move to a new phone.
- New SOP: [docs/sop/security.md](docs/sop/security.md) with the rest of the security checklist (Google 2-Step Verification for @mrkd.ca, 2FA on Supabase, Cloudflare, GitHub, Meta, Retool, GHL; switch off email links after Google sign-in).

## 2026-11-11: Logo
- New logo: a teal atom on a navy tile, **The Lab by MRKD**. In the sidebar, phone header, sign-in screen, browser tab, and as the icon when The Lab is added to a phone's home screen. Browser tab title is now "The Lab by MRKD".

## 2026-11-11: Clients page, and team changes in The Lab
- New **Clients** page: every client with status, ads manager and ad accounts. Owners and admins can set **Active / New / Paused / Inactive**, change the **ads manager**, and **link or unlink ad accounts**. These win over GHL and Retool, are marked "Changed in The Lab", logged, and can be undone ("Use GHL and Retool again"). Inactive clients disappear from Insights, Suggestions, Ad approval and the Meta sync. (Migrations 2400, 2500.)
- **Settings → Staff**: owners and admins can **remove someone from the team** (or add them back); they lose access straight away.
- Done at Jordan's request: Rising Tide (all four locations, with the three RTA ad accounts linked) and Gracie Barra Renton, Tacoma and Marysville moved to Zohirul; Overcome, Foundry, Campeao, Infinite Hitting Deerfield Beach, Storage-Tech, Bulls and Apex Ashburn removed; Swampfox paused; Andres Hernandez and "Dev MRKD" removed from the team.
- Gracie Barra White Rock's live ad account is now shared with The Lab and syncing.

## 2026-11-11: Staff screen, and Air is the only look
- **Settings → Staff**: everyone sees who's on the team, who has signed in, and how many Active/New clients each ads manager has. Owners and admins change roles there; only owners can make or change owners, there's always at least one owner, and every change is logged (migration 2300). Names, emails and ads manager stay in Retool.
- Jordan and Trent are now **owners** (set at Jordan's request, logged); everyone else is staff.
- **Old looks removed**: Air (light and dark) is the only look. Settings now just has Light / Dark / Match device. The unused second font was removed too, so the app loads a little faster.

## 2026-11-11: New look: Air, light and dark
- **G · Air is now the look for everyone** (light sidebar, white space, teal). Picked by Jordan.
- **Dark mode**: sun / moon button next to your name (phones: top right), or Settings → Look → Light / Dark / Match device. Match device is the default, so phones in dark mode get it automatically.
- The right look is applied before the page draws, so no flash, including on the sign-in screen.
- Suggestions page now says thresholds can be changed in Settings (it said "will be").

## 2026-11-11: Nightly backfill fix
- The 2:20am 37-day backfill now asks Meta for one week at a time. Atlantic MMA (752 ads) was failing on the 37-day request; the re-run synced all 45 accounts. The 30-minute syncs have been green every run since the retry fix.

## 2026-11-11: Four sleeker design options
- Added E · Graphite, F · Onyx, G · Air and H · Studio as options only ([design-options.md](docs/design-options.md#sleeker-options), with screenshots). Nothing changes for anyone until one is picked: try them in **Settings → Look → Sleeker options**.

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
