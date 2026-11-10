# Meta setup: app + system user token

Everything needed to give the platform permanent, read-only access to the client ad accounts. Written so it can be forwarded to whoever does it (Jordan or Trent). About 15 minutes. **Requires a Meta developer account** (developers.facebook.com → Get Started); Facebook may block new developer sign-ups from an unfamiliar device for a few days.

## What we're creating

| Thing | Value | Why |
|---|---|---|
| **Meta app** | Name `MRKD Platform`, type **Business**, owned by business portfolio **MRKD Digital Marketing Inc.** | Meta only issues permanent tokens through an app that belongs to the business. Nobody uses the app; it's a container. |
| **App product** | **Marketing API** | Needed to read ad accounts, campaigns, ads and insights. |
| **App mode** | **Development** to start. Switch to **Live** only if Meta refuses calls (Live needs a privacy policy URL, e.g. the MRKD website's). | Development is fine for a business's own system user on its own assets. |
| **Access level** | **Standard access** (the default). No App Review needed. | We only read accounts MRKD's business already has access to. Advanced access is only for apps used by other businesses. |
| **System user** | `MRKDPlatformTools`, role **Employee** (already created 9 Nov 2026). | A robot account that never logs out, so the connection doesn't expire like personal logins (a likely cause of Retool breaking). |
| **Token type** | **System user access token** | |
| **Token expiry** | **Never** | Permanent. Revoke from the same screen if ever needed. |

## Scopes (permissions on the token)

| Scope | Needed for | When |
|---|---|---|
| `ads_read` | Ad accounts, campaigns, ad sets, ads, creatives, insights (spend, leads, clicks…) | **Now** |
| `leads_retrieval` | Reading the leads people submit on lead forms | **Now** |
| `pages_show_list` | Listing the client Facebook pages (lead forms live on pages) | **Now** |
| `pages_read_engagement` | Reading lead form details (questions, intro, thank-you page) | **Now** |
| `pages_manage_ads` | Meta requires it alongside `leads_retrieval` to read leads | **Now** (add if leads come back empty without it) |
| `ads_management` | The **Turn off ad** button in suggestions | **Later** (Phase 1b), add then |
| `business_management` | Only if we need to list accounts through the business rather than the system user | Not needed unless asked |

Don't tick anything else. If a scope isn't listed when generating the token, the app is missing the **Marketing API** product (step 2).

## Checked 10 Nov 2026 (meta-check)

- Token permissions granted: `ads_read`, `ads_management`, `business_management`, `pages_show_list`, `pages_read_engagement`. (`leads_retrieval` and `pages_manage_ads` are **not** on it yet; needed for the leads list.)
- 54 ad accounts visible; **32 can edit ads** (pause works), **22 view-only** (assigned with View performance), so one-click Turn off won't work on those until they get **Manage campaigns**.

## Asset access for the system user (done 9 Nov 2026)

| Asset | Permission | Status |
|---|---|---|
| Ad accounts (all clients) | **View performance** | Done. Add **Manage campaigns** in Phase 1b. |
| Pages (all clients) | **Leads** (+ Insights) | Done, but broader than needed (Content, Messages…). Trim to Leads + Insights when convenient. |

## Steps

### 1. Create the app
1. **developers.facebook.com/apps** → **Create app**.
2. App name `MRKD Platform`, contact email → **Next**.
3. Use case: if offered, pick **Create & manage ads with Marketing API** (or **Measure ad performance data with Marketing API**). Otherwise pick **Other** → **Next** → app type **Business**.
4. Business portfolio: **MRKD Digital Marketing Inc.** → **Create app**.

### 2. Add the Marketing API
In the app dashboard, if Marketing API isn't already added: **Add product** (or **Use cases → Customize**) → **Marketing API** → **Set up**.

### 3. Connect the app to MRKD's business
1. **business.facebook.com/settings** → **Accounts → Apps**. If **MRKD Platform** is listed, it's connected (it is, if step 1 picked the MRKD portfolio).
2. If it isn't listed: **Add** → **Connect an app ID** → paste the **App ID** (top of the app dashboard) → **Connect app**.
3. Or from the app side: **App settings → Basic** → **Business portfolio** (or **Verification**) → **MRKD Digital Marketing Inc.** → **Save changes**.
4. Whoever does this must be an admin of both the app and the MRKD business portfolio.

### 3b. Let the system user use the app
1. **Accounts → Apps → MRKD Platform**.
2. **Assign people / Add people** → choose **MRKDPlatformTools** → permission **Manage app** (full control of the app only, not of ad accounts) → **Assign**.

### 4. Generate the token
1. **Business settings → Users → System users → MRKDPlatformTools → Generate token**.
2. App: **MRKD Platform**.
3. Token expiration: **Never**.
4. Tick the **Now** scopes from the table above.
5. **Generate token** and copy it. It's shown once.

### 5. Store it (never in chat, Slack or email)
1. Supabase → **Edge Functions → Secrets**: supabase.com/dashboard/project/mhayvuxqrlwyvalceerw/functions/secrets
2. Add secret: name **`META_SYSTEM_USER_TOKEN`**, value = the token → **Save**.
3. Tell Claude it's saved; Claude finishes the Meta sync and checks the numbers against Ads Manager.

### 6. Optional check
Paste the token into **developers.facebook.com/tools/debug/accesstoken** (Meta's own debugger, safe): it should say **Type: System User**, **Expires: Never**, and list the scopes above.

## If something goes wrong

| Message | Fix |
|---|---|
| "An app must be part of this business portfolio" when generating | The app isn't connected to MRKD's business (step 3), or the system user isn't assigned to it (step 3b). |
| A scope isn't in the list | Add the Marketing API product (step 2). |
| "You can't make this change at the moment… device you don't usually use" | Facebook security on new developer sign-ups. Use your usual device, have someone already registered as a developer do steps 1–3, or wait a few days. |
| Leads come back empty | Add `pages_manage_ads`, and check the page has **Leads** access for the system user. |

## Why not the existing "Conversions API System User"?

Its app ("Conversions API Application") isn't owned by MRKD's portfolio and was made for sending pixel events. It can't issue a key with the scopes above, and mixing jobs on one robot account makes it harder to switch either off. Leave it as is.
