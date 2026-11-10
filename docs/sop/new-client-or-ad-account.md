# SOP: New client or new ad account

**Who:** owner or admin (steps 1 and 2), the assigned ads manager (step 4). **When:** a client is onboarded or a client gets a new ad account.

For The Lab to show a client's numbers and suggestions, four things must be true:

| # | Must be true | Where it's set |
|---|---|---|
| 1 | The client exists, status **Active** or **New**, with an ads manager | Retool Clients View + GHL "Assigned to" |
| 2 | The ad account is shared with The Lab's Meta system user | Meta Business settings |
| 3 | The ad account is linked to the client | Retool Clients View (ad account on the client) |
| 4 | Data has synced | Automatic, within 30 minutes |

## 1. Client and ads manager

1. Onboard the client in Retool as today (Clients View / Onboarding). Status **New** or **Active**.
2. On the client's contact in **MRKD's GHL**, set **Assigned to** = the ads manager.
3. If the GHL sync in Retool seems behind (status or assignment not changing), click **Sync GHL** in Retool's Clients View.

## 2. Share the ad account with The Lab

1. **business.facebook.com** → Business settings → **Users → System users → MRKDPlatformTools**.
2. **Assign assets → Ad accounts** → tick the new account.
3. Permissions: **Manage campaigns** (needed for one-click Turn off) and View performance. Not "Full control".
4. **Save**.

The same screen fixes accounts that show "only lets The Lab view, not change ads" on Turn off: open the account under MRKDPlatformTools and add **Manage campaigns**.

## 3. Link the ad account to the client

In Retool's Clients View, set the client's Meta ad account as today. The Lab copies the link within 15 minutes.

## 4. Check it

After 30 to 45 minutes:
1. **Insights** → set the ads manager filter to **All ads managers** → search the client's name. Spend should match Ads Manager for the same dates.
2. Not there? See [troubleshooting.md](troubleshooting.md#an-account-is-missing-from-insights).

## Client leaves

Set the client's status in Retool to anything other than Active/New. The Lab stops syncing its campaigns and showing it on the next run. Optionally remove the ad account from MRKDPlatformTools in Business settings.
