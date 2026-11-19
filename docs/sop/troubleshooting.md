# SOP: Troubleshooting

Start with the **Sync status** screen; most problems show there first.

## Data looks old

"Data updated" under the Insights title says more than an hour.

1. Sync status → is the latest **Meta sync** red?
   - "token" or "OAuth" in the error: the Meta token was revoked or changed. [tokens-and-secrets.md](tokens-and-secrets.md#replace-the-meta-token).
   - "reduce the amount of data" for one account: Meta is slow for that account. The sync retries with smaller pages; it normally recovers next run.
   - "partial": some accounts failed, the rest are fine. Note which and check them next run.
2. No runs at all for an hour: the schedule stopped. Ask Claude (or a developer) to check `cron.job` in Supabase ([../background-jobs.md](../background-jobs.md#schedules)).

## An account is missing from Insights

Check, in order:
1. Client status in Retool is **Active** or **New**.
2. The ad account is linked to the client in Retool.
3. The ad account is assigned to **MRKDPlatformTools** in Business settings ([new-client-or-ad-account.md](new-client-or-ad-account.md#2-share-the-ad-account-with-the-lab)).
4. The ads manager filter is set to **All ads managers** (you might be looking at your own accounts only).
5. Wait 30 minutes after fixing any of the above.

## A client shows the wrong ads manager

The ads manager is **Assigned to** on the client's contact in MRKD's GHL, copied through Retool. Fix it in GHL. If Retool hasn't picked it up, click **Sync GHL** in Retool's Clients View. The Lab updates within 15 minutes of Retool.

## Suggestions look wrong

- Too many / too few: [changing-thresholds.md](changing-thresholds.md).
- A suggestion for an ad that's already off: it clears on the next run (within 30 minutes).
- An ads manager sees no suggestions: they may have none, or no clients assigned to them in GHL. The page says how many accounts they look after.

## Turn off failed

See [acting-on-suggestions.md](acting-on-suggestions.md#when-turn-off-doesnt-work).

## Lead form search is empty

Reading lead forms needs the `pages_manage_ads` permission on the Meta token, which isn't added yet (the Leads tab was removed on 12 Nov 2026: The Lab doesn't read people's names or contact details). Steps: [../setup/meta-access-checklist.md](../setup/meta-access-checklist.md#3-token-only-if-lead-form-search-is-wanted).

## Ad Studio won't load

- "Couldn't load the style kit": reload the page. Still failing: check you're signed in and on the live site (sample data has no kit).
- Stuck on "Loading the design engine": the browser downloads about 25 MB from cdn.jsdelivr.net the first time. On a slow or restricted network (some office Wi-Fi blocks CDNs) try another network.
- A "STOP:" message after Make ads comes from the kit itself, e.g. a Gracie Barra person on a non-GB gym. Read it and change that ad.

## A "Can't turn off from The Lab" row on Today

The Lab already asked Meta and knows Turn off would fail (view-only account, Page not shared, or billing). Use **Turn off in Ads Manager**, and fix the access: [../setup/meta-access-checklist.md](../setup/meta-access-checklist.md).

## Claude can't deploy or read the database ("Invalid access token")

Claude's Supabase access token expired. [tokens-and-secrets.md](tokens-and-secrets.md#renew-claudes-supabase-access-token).

## Someone can't sign in

[signing-in.md](signing-in.md#if-something-goes-wrong).

## The page looks broken or a button does nothing

1. Reload the page (on a phone, close and reopen the app).
2. If "The Lab was updated. Reload" shows, click it.
3. Still broken: screenshot it with the time and tell the person maintaining The Lab.

## Retool copy failed

Usually the Retool database password was reset. [tokens-and-secrets.md](tokens-and-secrets.md#retool-connection-changed).
