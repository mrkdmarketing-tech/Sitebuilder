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

## Changing the schema

Add a **new** migration file (never edit one that has been applied to Supabase), with policies for any new table, then update this page and run `npm run db:test`.
