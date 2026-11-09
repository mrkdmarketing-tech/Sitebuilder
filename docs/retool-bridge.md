# Retool bridge

**Why:** Clients View, Onboarding and the lead-sheet syncs stay in Retool for now ([plan.md §5](plan.md#5-build-phases)). The new app still needs some of that data, so a job copies it across. It never writes to Retool.

**How:** `supabase/functions/retool-bridge` connects to the Retool Database (it's ordinary Postgres) using the connection string in the secret `RETOOL_DB_URL`, runs read-only `SELECT`s, and upserts into Supabase every **15 minutes**.

## What's copied

| Supabase table | From Retool | Notes |
|---|---|---|
| `employees` | `employees` | ids are GHL user ids |
| `clients` | `clients` + `ghl_contacts` | `ad_manager_id` = the GHL contact's **`assignedTo`** field, the same source Retool's Meta Ads Insights uses for the ads manager filter. Unknown GHL users → null. |
| `client_onboarding` | `campaign_onboarding_info` | |
| `campaign_specifics` | `campaign_specifics` | |
| `sheet_leads` | `leads` | Lead outcomes from client Google Sheets (Retool keeps syncing the sheets) |
| `website_campaign_requests` | `website_campaign_requests` | |
| `ghl_custom_fields` | `ghl_locations.custom_fields_metadata` (agency) | |

**Not copied:** any token or secret column (`ghl_access_token`, `ghl_locations.access_token`, `leadlabzCalendar.api_key`), Meta tables (the new app syncs Meta itself), Stripe, GPT chat, test tables.

Order: employees → clients → the rest (foreign keys). Rows deleted in Retool are deleted here too. `retool_bridge_state` records the last successful copy and row count per table.

## Setting it up (Phase 0)

1. In Retool → Database → **Connect** (or settings): copy the **connection string** (starts with `postgresql://`).
2. In Supabase → Project Settings → Edge Functions → Secrets → add `RETOOL_DB_URL` with that value.
3. Don't paste it anywhere else (chat, Slack, repo).

## Switching off

When a later phase moves a module out of Retool (e.g. Onboarding), its table is removed from the bridge list and the new app becomes the source. When everything has moved, the bridge is deleted and Retool can be cancelled.
