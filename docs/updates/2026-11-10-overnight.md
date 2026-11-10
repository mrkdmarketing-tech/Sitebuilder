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
| 6 | Owner/admin roles for you and Trent | Only owners/admins can change thresholds | Tell me who gets what; I won't change roles without it. |
| 7 | Pick a design | | Settings → Look |

## Not done yet

- Slack and ClickUp notifications for ad approval (Retool sent these). Reviewers see new ads in **Needs me** meanwhile.
- Picking an existing Meta lead form from a list (it's typed in for now).
- GHL sidebar link (waiting for your go-ahead).

## Overnight jobs

Checked at 04:05 UTC (11:05pm Toronto): Retool copy green every 15 minutes (41 runs in 24 h), suggestions green, Meta sync green apart from the temporary Meta errors above (fixed). The 2:20am 37-day backfill is checked after it runs; results are added below.
