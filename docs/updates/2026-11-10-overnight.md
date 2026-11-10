# Overnight update: 10 to 11 Nov 2026

What was built while Jordan slept, what to test, and what's needed. Live at https://sitebuilder-6iw.pages.dev (reload once if you see "The Lab was updated").

## Done

| What | Where to look | Notes |
|---|---|---|
| **Ad approval** (replaces Retool's Ad Preview) | **Ad approval** tab | List with Needs me / In progress / All / From Retool, New ad, full editor (setup, creative, images and videos, lead form, notes), templates that fill in the client's details, client info panel, 11-point checklist, comments, history. |
| **"Hey, just double checking"** | Submit an ad with open issues | Lists the open issues with **Go back and fix** / **Submit anyway**. Submitting anyway is recorded. |
| **Check for mistakes** (AI) | Button on each ad | Reads the copy, lead form, text in images and subtitles in videos (stills taken in the browser, no audio), checks against the client's details. **Needs the Claude key** (below); until then it says it isn't set up. |
| **Retool history** | Ad approval, **From Retool** | All 596 Retool ads, 13 creative + 8 lead form templates, copied read-only every 15 minutes. Images weren't copied (Retool stored them inside the database); the screen says how many there were. |
| **Settings** | **Settings** tab (phone: bottom bar) | Owners/admins change suggestion thresholds; every change is logged. Also a **Look** switch to try the 4 designs on real data. |
| **4 sleeker design options** | Settings → Look → **Sleeker options**, or [design-options.md](../design-options.md#sleeker-options) | E · Graphite, F · Onyx, G · Air, H · Studio. Not applied; everyone still sees Classic. |
| **SOPs** | [docs/sop/](../sop/README.md) | 12 step-by-step procedures for ads managers and admins. |
| **Meta sync retry** | Sync tab | Meta's "Service temporarily unavailable" was failing one random account most hours. The sync now waits and retries those. |

All tests pass (60 app tests, 6 database test files). Nothing here changes live ads, GHL, Retool or anyone's role.

## Please test (10 minutes)

1. **Ad approval → New ad** on one of your clients. Pick a creative template and check the placeholders filled in (business name, city...). Upload an image and a short video.
2. **Submit for approval** with yourself as reviewer, then **Approve** or **Request changes** from the same ad.
3. **From Retool**: open a few old ads and check they look right.
4. **Settings → Look**: try the four **sleeker options** (E to H) and tell me which one, or what to mix.
5. Still open from yesterday: **Turn off** one ad from Suggestions (after reloading) and check it in Ads Manager.

## Needed from you

| # | What | Why | How |
|---|---|---|---|
| 1 | **Claude API key** | Turns on "Check for mistakes" | [sop/tokens-and-secrets.md](../sop/tokens-and-secrets.md#add-the-claude-key-ai-ad-check). Set a monthly limit (e.g. $50). Expect about 1 to 5 cents per check. |
| 2 | **Share Gracie Barra White Rock's ad account** | Its live account (1756466474934621) isn't shared with MRKDPlatformTools, so its numbers and suggestions are missing. Only an old closed account is shared. | [sop/new-client-or-ad-account.md](../sop/new-client-or-ad-account.md#2-share-the-ad-account-with-the-lab) |
| 3 | Google sign-in | Easier sign-in than email links | [setup/hosting-and-signin.md](../setup/hosting-and-signin.md#google-sign-in-staff-use-their-mrkdca-google-account) |
| 4 | `leads_retrieval` on the Meta token | Leads tab | [setup/meta.md](../setup/meta.md) |
| 5 | "Manage campaigns" on the 22 view-only accounts | One-click Turn off there | List in [setup/meta.md](../setup/meta.md) |
| 6 | ~~Owner/admin roles for you and Trent~~ | Done 11 Nov: Jordan and Trent are owners. Other roles: Settings → Staff. | |
| 7 | ~~Pick a design~~ | Done 11 Nov: Air, with light and dark mode. | |

## Not done yet

- Slack and ClickUp notifications for ad approval (Retool sent these). Reviewers see new ads in **Needs me** meanwhile.
- Picking an existing Meta lead form from a list (it's typed in for now).
- GHL sidebar link (waiting for your go-ahead).

## Overnight jobs

Checked at 04:05 UTC (11:05pm Toronto) and again at 07:51 UTC (2:51am Toronto).

| Job | Result |
|---|---|
| Meta sync, every 30 min | Before the retry fix, about half the hourly runs missed one account because of Meta's temporary errors. After it (04:30 to 07:30 UTC): **7 of 7 runs green**, 45 accounts each. |
| 2:20am 37-day backfill | 44 of 45 accounts. Atlantic MMA (752 ads) failed: Meta gives "unknown error" when asked for 37 days of daily rows at once. **Fixed:** long ranges are now requested a week at a time. Re-ran at 2:57am: **45 of 45 green**, 7,000 daily rows. |
| Retool copy, every 15 min | 15 of 15 green, including the new ad history and templates. |
| Suggestions, :10 and :40 | 8 of 8 green. |
