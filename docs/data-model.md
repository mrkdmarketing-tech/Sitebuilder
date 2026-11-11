# Data model

Every table and database function, what it's for and where its data comes from. SQL lives in [`supabase/migrations/`](../supabase/migrations), applied in filename order. Tested by [`supabase/tests/`](../supabase/tests) ([development.md](development.md#database-tests)).

**Who writes what:** "Job" = written only by background jobs (service role). "Staff" / "Admin" = can be written from the app by those roles. Everyone signed in as an active employee can read every table ([auth.md](auth.md)).

## 0100 Foundation

| Table | Purpose | Written by |
|---|---|---|
| `employees` | Staff. `id` = their GoHighLevel user id. `is_ad_manager`, `slack_id`, `role` (staff / admin / owner), `auth_user_id` (linked on first login). | Bridge (from Retool) + Admin |
| `clients` | One row per client, **same ids as Retool**. `ad_manager_id` → employees (from GHL "Assigned to"), `active_status`, GHL contact/location ids, lead sheet URL, `profile` (decoded GHL custom fields). | Bridge |
| `client_statuses`, `ad_types`, `booking_types`, `cta_options` | Lookup lists (Retool `enum_*` tables), pre-filled with Retool's values. | Admin (staff can add ad types) |
| `app_settings` | Key/value settings. | Admin |
| `sync_runs` | One row per background job run: job, start/finish, status (running/ok/partial/error), rows, error. Powers the Sync status screen. | Job |
| `actions_log` | Audit trail: who did what (e.g. paused an ad), before/after, result. Nobody can edit or delete. | Job + Staff (as themselves only) |

## 0200 Meta

Synced by `meta-sync` every 30 min ([background-jobs.md](background-jobs.md)). Real foreign keys link account → campaign → ad set → ad.

| Table | Purpose |
|---|---|
| `meta_ad_accounts` | Ad accounts. `account_id` (no `act_` prefix), `account_status` label (ACTIVE, UNSETTLED…), `client_id` → clients. |
| `meta_campaigns` | Name, status, effective status, objective, daily budget (in currency units, converted from cents), buying type, bid strategy, pacing. |
| `meta_adsets` | Name, status, optimization goal, Advantage+ flag, learning stage, age range, genders, targeting. |
| `meta_ads` | Name, status, creative. |
| `meta_ad_creatives` | Title, body, CTA, image/thumbnail/video, permalink. Full-text indexed for search. |
| `meta_ad_insights_daily` | **One row per ad per day**: spend, impressions, reach, clicks, link clicks, leads, comments, page likes, messages, plus every Meta action in `actions`. All reporting adds these up. |
| `meta_pages`, `meta_leadgen_forms` | Facebook pages and lead forms (questions, intro card, thank-you page). Full-text indexed. |
| `meta_leads` | Individual Meta leads (name, email, phone, form answers). |

Every Meta table keeps the raw API response in `raw` so new fields can be used without re-syncing.

## 0300 Retool bridge

Copied from Retool's database every 15 min, read-only ([retool-bridge.md](retool-bridge.md)). Column names mirror Retool's.

| Table | Retool source | Used for |
|---|---|---|
| `sheet_leads` | `leads` (from client Google Sheets) | Booked / shown / closed / closed value / value generated |
| `client_onboarding` | `campaign_onboarding_info` | Business info panel in ad approval; AI "does it match the client?" checks |
| `campaign_specifics` | `campaign_specifics` | Budgets, CTA, booking link, area callouts |
| `website_campaign_requests` | `website_campaign_requests` | LeadLabz website requests shown in ad approval |
| `ghl_custom_fields` | `ghl_locations.custom_fields_metadata` (agency) | Decoding GHL custom fields, template placeholders |
| `retool_bridge_state` | – | Last successful copy per table |

## 0400 Suggestions

| Table | Purpose |
|---|---|
| `rule_settings` | Thresholds. One `global` row (pre-filled with the agreed values: $50 CPL, $50 no-lead spend, 60% / $80 budget hog, 0.8% CTR, 0.5% link CTR, 1,000 impressions, 3 days), plus optional overrides per ad type or client. Admin only. |
| `suggestions` | One row per problem found. `key` = rule + entity, so the same problem isn't suggested twice. Status: open → done / snoozed / dismissed / resolved (cleared on its own). Keeps the evidence (spend, leads, CPL…) and, for budget hogs, the sibling ads. |

## 0500 Ad approval

| Table | Purpose |
|---|---|
| `ad_reviews` | One ad submission: client, name, ad type, booking type, status (draft → review_pending ↔ request_changes → approved → completed), creative copy, lead form, templates used, timestamps, and **how many AI findings were still open when submitted**. `legacy_id` = Retool `ads_preview.id` for imported history. |
| `ad_review_assets` | Uploaded images/videos (stored in the private `ad-assets` bucket) or Canva links. |
| `ad_review_check_runs` | Each AI quality-check run (model, cost, status). |
| `ad_review_findings` | Each issue the AI found: where (field, image, video timestamp), category (spelling / grammar / logic / mismatch / CTA), message, suggested fix, status (open / fixed / ignored). |
| `ad_review_comments` | Comment thread. |
| `review_checklist_items` | The 11-point reviewer checklist from Retool, with which items AI can pre-check. |
| `ad_review_checklist` | Ticks per review (and the AI's pass/fail/unsure). |
| `ad_review_events` | Status history, including which warnings were acknowledged on "Submit anyway". |
| `ad_creative_templates`, `leadform_templates` | Templates (imported from Retool). |

## 0600 Reporting functions

| Function | Returns |
|---|---|
| `report(level, from, to, include_inactive = false)` | JSON array of rows for `account` / `campaign` / `adset` / `ad`: names, parents, client, ads manager, status, raw totals and lead-sheet outcomes. Shape = `ReportRow` in `shared/domain/types.ts`. |
| `leads_report(from, to)` | Meta leads with form and ad names. |
| `recent_leads_by_account(days)` | Leads per account over the last N days (suggestion rule 7). |
| `search_lead_forms(query)`, `search_ad_copy(query)` | Safe, parameterised search (replaces Retool's string-built SQL). |
| `delivery_status(...)`, `meta_account_is_active(...)` | Status helpers used above. |
| `report_ad_base(...)`, `sheet_outcomes(...)`, `totals_json(...)` | Building blocks of `report()`. |

## 0700 Security

Row-level security is on for **every** table (a test fails if any table is missing it). Helper functions `is_staff()`, `is_admin()`, `current_employee_id()`. Full rules: [auth.md](auth.md).

## 0800 Storage

Private bucket `ad-assets` (images/videos up to 500 MB) readable and writable only by signed-in staff.

## 0900 Suggestions per employee

Suggestions are visible to and actionable by **only the assigned ads manager** (plus admins/owners). Adds `me()` (the signed-in employee, used by the app) and a trigger that moves open suggestions to the new manager when a client is reassigned in GHL. See [suggestions.md](suggestions.md#who-sees-which-suggestions).

## 1000 Hardening

Pins `search_path` on every function and stops signed-out visitors calling the helper functions (from Supabase's security advisor). See [auth.md](auth.md#supabase-security-advisor).

## 1100 Retool bridge (SQL)

`private.retool_bridge_run(conn)`: copies Retool tables over `dblink` into the bridge tables (rules in [retool-bridge.md](retool-bridge.md)). Only the service role can run it. Tested against a fake Retool database (`supabase/tests/retool-fake.sql`).

## 1200 Schedules

`pg_net` + `pg_cron`; `private.call_function(name)` calls an Edge Function with the cron secret from Vault. Schedules: [background-jobs.md](background-jobs.md#schedules).

## 1300 Meta schedule

`meta-sync` every 30 min (last 3 days) and a nightly 37-day backfill. See [background-jobs.md](background-jobs.md#schedules).

## 1400 Sign-in link

Trigger on `auth.users`: a new login is linked to the active employee with the same email. See [auth.md](auth.md).

## 1500 Faster access checks

Access-rule helpers are wrapped as `(select …)` so they run once per query instead of once per row (same rules). Account report for a signed-in user went from 8.1 s (timing out) to 0.18 s. Also indexes `sheet_leads.date_added`.

## 1600 / 1700 Suggestion rules and schedule

1600 retires the old budget-hog "max leads" setting. 1700 schedules `run-rules` at :10 and :40 and indexes suggestions by status.

## 1800 Realtime

Adds `sync_runs` to Supabase Realtime so open screens reload when a job finishes.

## 1900 Audit log ad link

`actions_log.ad_id` (optional, set by Turn off) so the app can show the ad name next to each action.

## 2000 Settings

`save_rule_settings(params)`: owners/admins change the global suggestion thresholds from the **Settings** screen. Refuses unknown keys, text and out-of-range values; records who changed it (`rule_settings.updated_by`) and the before/after in `actions_log` (`rules.update`). Tested in `supabase/tests/settings.test.sql`.

## 2100 Ad approval screens

- `set_review_status(review, to, note, reviewer, acknowledged)`: the only way to change an ad's status (a trigger blocks direct changes from the app). Checks the move is allowed, stamps submitted / reviewed / completed times, counts open findings on submit (`submitted_with_open_findings`), defaults the reviewer to the client's ads manager, writes `ad_review_events` and saves the note as a comment.
- `ad_review_list()`: the Approvals list in one call (names, open findings, first preview).
- `client_brief(client)`: business details for the editor, template placeholders and the AI check. Decodes GHL custom fields with `ghl_custom_fields`, leaving out billing ids, payment links and internal document links.
- New columns: `ad_reviews.legacy` (what was kept from Retool), `ad_review_assets.frames` (JPEG previews made in the browser), `ad_review_findings.finding_key` (to keep "Ignore" across checks).
- Imported Retool ads (`legacy_id` set) are read-only: restrictive policies on the ad and every child table. Comments can only be added as yourself.

## 2200 Retool bridge, part 2

`private.retool_bridge_ad_history(conn)`, run by `retool-bridge` after the main copy: GHL custom field names (`ghl_custom_fields`), ad creative and lead form templates, and Retool's Ad Preview (`ads_preview` → read-only `ad_reviews`). Base64 images are stripped on Retool's side. Details: [ad-approval.md](ad-approval.md#history-from-retool).

## 2300 Staff roles

`set_employee_role(employee, role)` and `staff_overview()` for **Settings → Staff**. Rules: owners/admins only, only owners touch owners, never zero owners, every change logged. A trigger stops the app editing `employees` directly (the Retool bridge and sign-in link run with elevated rights and aren't affected). Tested in `supabase/tests/zz_staff.test.sql`.

## 2400 Overrides set in The Lab

`client_overrides` (ads manager and/or status per client) and `ad_account_overrides` (which client an ad account belongs to). BEFORE triggers on `clients` and `meta_ad_accounts` apply them on every write, so the Retool copy can't undo them; removing one hands control back to GHL/Retool on the next copy. Owners/admins only; every change logged (`override.*`). Tested in `supabase/tests/zz_overrides.test.sql`.

## 2500 Staff and client controls

- `employee_overrides` + `set_employee_active()`: owners/admins take someone off the team (or back), winning over Retool. Can't remove yourself; only owners remove owners; never the last owner.
- `set_client_control()`: the Clients screen's single call: status, ads manager, link/unlink ad accounts, or clear all Lab changes. Clears open suggestions for clients no longer Active/New.
- `client_list()`, `unlinked_ad_accounts()`: the Clients screen.

## 2600 Two-step sign-in for owners and admins

`mfa_ok()` (session confirmed with an authenticator code, `aal2`); `is_admin()` now requires it, so every admin-only policy and function does. `set_employee_role` / `set_employee_active` check it with a clear message. `two_step_on()` and a new `staff_overview().twoStep` show who has it on; `reset_two_step()` lets an owner/admin clear someone else's (lost phone), logged. Tested in `zz_staff.test.sql`.

## 2700 Ad approval Slack messages

`app_settings` key `approvals.default_reviewer` (Jordan): who reviews a submitted ad when nobody is picked. `set_review_status()` now falls back to: the ad's reviewer so far, then the default reviewer if still active, then the client's ads manager. Trigger `ad_review_events_notify` calls the `approval-notify` function (through `private.call_function`, pg_net, so it never slows or fails the click) for every status change of an ad made in The Lab; Retool imports never post.

## 2800 Creative tags

`creative_tags` (one row per ad creative: offer, audience, hook, Jev's confidence, model, input hash), written only by the `tag-creatives` function. `creatives_to_tag(limit)` (service role only) lists untagged creatives with copy, biggest recent spenders first. `creative_tag_report(from, to)` sums spend and leads by tag (and image/video) for Active/New clients' ads that spent in the period. Hourly schedule `tag-creatives` at :50. See [creative-tags.md](creative-tags.md).

## Changing the schema

Add a **new** migration file (never edit one that has been applied to Supabase), with policies for any new table, then update this page and run `npm run db:test`.
