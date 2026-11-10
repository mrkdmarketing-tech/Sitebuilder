# Retool bridge

**Why:** Clients View, Onboarding and the lead-sheet syncs stay in Retool for now ([plan.md §5](plan.md#5-build-phases)). The new app still needs some of that data, so a job copies it across. It never writes to Retool.

**Status: live since 9 Nov 2026.** First run copied 63,832 rows in about 5 seconds.

**How:** every **15 minutes** `pg_cron` calls the `retool-bridge` Edge Function (migration 1200). The function passes the Retool connection string from its secret `RETOOL_DB_URL` to the database function `private.retool_bridge_run` (migration 1100), which reads each Retool table over `dblink` with plain read-only `SELECT`s and upserts it here. Nothing is ever written to Retool, and no session settings are changed on Retool's shared connection pool (the warning shown on Retool's Connection screen). The connection string is never stored in a table. Each run is logged in `sync_runs` and per table in `retool_bridge_state`.

Rules applied while copying:
- Ads manager = the GHL contact's `assignedTo`; a GHL user who isn't in `employees` becomes "no ads manager".
- Unknown client statuses become blank; ad accounts, leads and requests of unknown clients are kept but unlinked.
- If two staff share an email (or it's already used), the email is left blank for an admin to fix (emails are used for sign-in).
- Leads deleted in Retool are deleted here; for onboarding, the newest row per client wins.
- Ad accounts: Retool supplies the **client link**; name and status come from Retool only until the Meta sync has written that account.

## What's copied

| Supabase table | From Retool | Notes |
|---|---|---|
| `employees` | `employees` | ids are GHL user ids |
| `clients` | `clients` + `ghl_contacts` | `ad_manager_id` = the GHL contact's **`assignedTo`** field, the same source Retool's Meta Ads Insights uses for the ads manager filter. Unknown GHL users → null. |
| `client_onboarding` | `campaign_onboarding_info` | |
| `campaign_specifics` | `campaign_specifics` | |
| `sheet_leads` | `leads` | Lead outcomes from client Google Sheets (Retool keeps syncing the sheets) |
| `website_campaign_requests` | `website_campaign_requests` | |
| `ghl_custom_fields` | `ghl_locations.custom_fields_metadata` (MRKD agency location only) | Field names for decoding client info. Live since 10 Nov 2026 (migration 2200); 147 fields. The location's access token is never read. |
| `ad_creative_templates`, `leadform_templates` | same names | 13 and 8 on 10 Nov 2026. Templates made in The Lab are never touched. |
| `ad_reviews` (read-only, `legacy_id` set) | `ads_preview` | Ad Preview history: 596 ads. Images (base64) stripped by Retool's database before sending. See [ad-approval.md](ad-approval.md#history-from-retool). |

Parts: `private.retool_bridge_run` (migration 1100) copies the tables above it in this list; `private.retool_bridge_ad_history` (migration 2200) copies custom fields, templates and Ad Preview. The `retool-bridge` function runs both each time.

**Not copied:** ad images stored in `ads_preview`, any token or secret column (`ghl_access_token`, `ghl_locations.access_token`, `leadlabzCalendar.api_key`), Meta tables (the new app syncs Meta itself), Stripe, GPT chat, test tables.

Order: employees → clients → the rest (foreign keys). Rows deleted in Retool are deleted here too. `retool_bridge_state` records the last successful copy and row count per table.

## First run (9 Nov 2026)

| Table | Rows |
|---|---|
| employees | 6 (4 ads managers) |
| clients | 221 |
| meta_ad_accounts | 188 (132 linked to a client) |
| sheet_leads | 63,242 |
| client_onboarding | 77 |
| campaign_specifics | 92 |
| website_campaign_requests | 6 |

Active/New clients per ads manager: Adam Schmidt 26, Jordan Bosley 14, Zohirul Islam 9, Trent Forrest 1, unassigned 1 (matches Retool's Meta Ads Insights).

## Checking on it

- App: **Sync status** screen (once real data is connected).
- SQL: `select * from sync_runs where job = 'retool_bridge' order by id desc limit 5;` and `select * from retool_bridge_state;`

## Setting it up (done 9 Nov 2026)

1. In Retool → **Database** → click **Database ˅** (top left) → **Settings → Connection** → click the eye icon on **Postgres connection URL** and copy it. (Only Retool admins see the Connection tab. Never click **Reset password** there.)
2. In Supabase → **Edge Functions → Secrets** (supabase.com/dashboard/project/mhayvuxqrlwyvalceerw/functions/secrets) → add `RETOOL_DB_URL` with that value.
3. Don't paste it anywhere else (chat, Slack, repo).

## Switching off

When a later phase moves a module out of Retool (e.g. Onboarding), its table is removed from the bridge list and the new app becomes the source. When everything has moved, the bridge is deleted and Retool can be cancelled.
