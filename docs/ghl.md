# GHL (direct connection)

**Status (19 Nov 2026):** live, read-only. **Client status and ads manager now follow GHL directly** (migration 3500), and clients that exist only in GHL are added to The Lab (migration 3600). Other client details (name, onboarding, lead sheet) still come from the Retool copy ([retool-bridge.md](retool-bridge.md)).

Why: on 19 Nov, clients marked Active in GHL weren't showing. Retool's copy of GHL lags (Elite Team Monterey was Active in GHL on 18 Nov but blank in Retool), and a client made in GHL without a Client ID never reaches Retool at all (Truro Brazilian Jiu Jitsu).

## How MRKD uses GHL

- Every client is a **contact in MRKD's own GHL sub-account** (location `1Pbw0cdWjFMBsIFPrA0d`): 221 contacts on 12 Nov 2026.
- The **ads manager** is the contact's **Assigned to** (a GHL user; The Lab's staff ids are GHL user ids).
- **Client status** is the custom field "Client Status" (`contact.client_status`: New, Active, Paused, Inactive). **Client ID** (`contact.client_id`) is the client's number.
- Each client also has its own sub-account (`clients.ghl_location_id`, 55 of them) for its leads and appointments. Not read yet.

## What the connection does

`ghl-sync` (Edge Function, hourly at :25 while comparing, migration 3200):

1. Reads the team: `GET /users/?locationId=...` → `ghl_users_live`.
2. Reads each client's contact: `GET /contacts/{id}` for every client The Lab knows → `ghl_contacts_live` (status, client id, assigned to, and the full contact).
3. Finds every contact with a Client Status: `POST /contacts/search` with the filter "Client Status exists" (229 contacts on 19 Nov, 3 pages of 100).
4. **Adds clients that exist only in GHL** (`add_ghl_clients`, migration 3600), when all of these are true: the contact has a **company name**, is **assigned to a team member**, and its status is **Active, New or Paused**. They get ids from 900001 up (Retool's ids are lower) and `source = 'ghl'`. Contacts that are only a person or an email (old billing contacts, for example) are left out.
5. **Applies GHL's status and ads manager** (`apply_ghl_live()`, migration 3500): a trigger on `clients` (`clients_00_from_ghl`) takes `client_status` and `assigned_to` from `ghl_contacts_live` on every write, so the Retool copy can't put back an old value. If Retool later creates the same client, `merge_ghl_clients()` moves everything to Retool's id and removes the GHL-only row.
6. Counts the differences with the Retool copy (`ghl_compare()`): shown on the **Sync** screen ("GHL (direct, read-only)") and listed by `select * from ghl_compare()`.

**Who wins:** a change made in The Lab (Clients screen or the Insights status badge, `client_overrides`) beats GHL, so a Lab change is never undone silently. To hand a client back to GHL, set it to the same value as GHL, or ask Claude to remove the override.

**Diagnostics:** `ghl-sync?search=<text>` returns matching contacts (read-only); `?search=*` gives the total contact count and `?search=has-status` the count with a Client Status.

API: `https://services.leadconnectorhq.com`, header `Version: 2021-07-28`, bearer token. Contact parsing: `shared/domain/ghl.ts` (tests: `ghl.test.ts`).

**Never writes to GHL.** The token is created with "View" permissions only. Changes made in The Lab (status, ads manager) stay in The Lab until writing back is agreed; `ghl_compare()` marks those as "Set in The Lab".

**Limits:** GHL allows 100 requests per 10 seconds and 200,000 a day per sub-account. One run is about 220 requests, 4 at a time.

## Setup

One secret, `GHL_PRIVATE_TOKEN`: steps in [sop/tokens-and-secrets.md](sop/tokens-and-secrets.md#connect-ghl-read-only). A **private integration** token made inside a sub-account works on Starter and Unlimited plans; agency-level tokens need Agency Pro and aren't needed here. Retool has its own GHL token; The Lab never copies it, so each can be switched off on its own.

## First run (12 Nov 2026)

- GHL and the Retool copy agree on every client's status and ads manager.
- **Different in The Lab only** (changed by Jordan in The Lab; GHL still has the old value until someone updates it there, or writing back is switched on): Apex Performance Center, Bulls Jiu Jitsu, Campeao Jiu-Jitsu Acworth, Infinite Hitting Deerfield Beach, Overcome Jiu Jitsu Pinnacle, Storage-Tech, The Foundry (Inactive in The Lab, Active in GHL); Swampfox (Paused in The Lab, Active in GHL).
- **No Client Status in GHL:** the three Rising Tide clients (Active in The Lab), Elite Team Monterey and Cave Academy.
- Client 41 is a contact called "Business Name" with no Client ID: probably a test contact.
- GHL users not in The Lab: "Alex m", "MRKD Admin", "MRKD Marketing" (shared or old logins; left out on purpose).

## 19 Nov 2026: status from GHL

- **Truro Brazilian Jiu Jitsu**: in GHL only (no Client ID), added as client 900001 (Active, Adam), and its Meta ad account "Truro BJJ" (3355307331455804) linked to it.
- **Elite Team Monterey** (client 264): now Active from GHL. It has **no Meta ad account** shared with MRKD's system user yet, so it can't appear on Insights until one is shared and linked on the Clients screen.
- **AACE and Barrhaven**: Inactive because they were set Inactive in The Lab on 16 Nov, after their last GHL change. The Lab change wins; set them back on the Clients screen if that was a mistake.
- Contacts with a Client Status but left out (no company name, or not assigned to the team): 7 email-only contacts and "jj padilla" (a person, tag "infinite").

## Next steps

1. Token added → first run → check `ghl_compare()` with Jordan.
2. A week of matching runs → The Lab reads clients, status and ads manager from GHL directly; the Retool copy stops for those tables. Run every 15 minutes.
3. ~~New clients: find them in GHL directly.~~ Done 19 Nov (step 4 above).
4. Later, when agreed: each client's own sub-account (appointments, opportunities) for lead quality, and writing back to GHL.
