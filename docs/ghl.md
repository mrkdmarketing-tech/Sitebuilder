# GHL (direct connection)

**Status (12 Nov 2026):** live, read-only. First run: 221 client contacts and 7 users read, no errors, **no differences with the Retool copy**. The Lab still uses the Retool copy of GHL data ([retool-bridge.md](retool-bridge.md)); the direct connection runs alongside it so we can compare before switching.

## How MRKD uses GHL

- Every client is a **contact in MRKD's own GHL sub-account** (location `1Pbw0cdWjFMBsIFPrA0d`): 221 contacts on 12 Nov 2026.
- The **ads manager** is the contact's **Assigned to** (a GHL user; The Lab's staff ids are GHL user ids).
- **Client status** is the custom field "Client Status" (`contact.client_status`: New, Active, Paused, Inactive). **Client ID** (`contact.client_id`) is the client's number.
- Each client also has its own sub-account (`clients.ghl_location_id`, 55 of them) for its leads and appointments. Not read yet.

## What the connection does

`ghl-sync` (Edge Function, hourly at :25 while comparing, migration 3200):

1. Reads the team: `GET /users/?locationId=...` → `ghl_users_live`.
2. Reads each client's contact: `GET /contacts/{id}` for every client The Lab knows → `ghl_contacts_live` (status, client id, assigned to, and the full contact).
3. Counts the differences with the Retool copy (`ghl_compare()`): shown on the **Sync** screen ("GHL (direct, read-only)") and listed by `select * from ghl_compare()`.

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

## Next steps

1. Token added → first run → check `ghl_compare()` with Jordan.
2. A week of matching runs → The Lab reads clients, status and ads manager from GHL directly; the Retool copy stops for those tables. Run every 15 minutes.
3. New clients: find them in GHL directly (contacts with a Client ID) rather than only the ones Retool knows.
4. Later, when agreed: each client's own sub-account (appointments, opportunities) for lead quality, and writing back to GHL.
