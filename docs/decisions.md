# Decision log

Why things are the way they are. Newest first. Add an entry whenever a real choice is made.

| Date | Decision | Why | Alternatives considered |
|---|---|---|---|
| 2026-11-09 | The app is called **The Lab** (sign-in screen, browser tab, top bar, Google sign-in screen) | Jordan's choice | – |
| 2026-11-09 | **MRKD connector for Claude** (MCP on Supabase, OAuth per employee, read-only first) as Phase 1c | Employees query data with their own Claude login under the same permissions as the app | Sharing a database login with Claude; Supabase's developer MCP (too much access) |
| 2026-11-09 | **Simple and organised style, no emojis** in the app or docs; plain labels, line icons only for navigation | Jordan's preference | Emoji labels as in Retool |
| 2026-11-09 | **Suggestions per employee**: staff see only accounts assigned to them in GHL; owners/admins see all; enforced by RLS | Requested by Jordan | Everyone sees everything with a filter |
| 2026-11-09 | **Four design options** (Classic, Midnight, MRKD Bold, Compact) switchable via design tokens; pick one later | Requested by Jordan | Committing to one look now |
| 2026-11-09 | **Fonts bundled** with the app (Inter, Space Grotesk) | No third-party requests; works in GHL iframe and offline | Google Fonts |
| 2026-11-09 | **Shared rules/formula code** in `shared/`, used by app and jobs | One formula per KPI; suggestions and dashboard can't disagree | Duplicating logic in SQL and TypeScript |
| 2026-11-09 | Database returns **raw totals**; KPIs computed in TypeScript | Single source of truth for formulas (see above), easy to test | Computing CPL etc. in SQL |
| 2026-11-09 | **Sample data mode** when Supabase isn't configured | Lets Jordan/Trent review screens before accounts exist; makes local dev easy | Waiting for real data |
| 2026-11-09 | Selecting accounts also **filters the other tabs** | Natural drill-down; Retool only recalculated KPIs | Retool's behaviour only |
| 2026-11-09 | Suggestion thresholds: CPL > $50, > $50 no leads, budget hog ≥ 60% share & (no leads or > $80 CPL), CTR < 0.8%, link CTR < 0.5% | Agreed with Jordan; CTR and 60% values are starting points to tune | – |
| 2026-11-09 | Ad approval: "publish" = **submit for approval**; uploads are manual; AI warnings never block ("Submit anyway") | Agreed with Jordan | Creating ads in Meta from the app (bigger scope) |
| 2026-11-09 | **No audio check** for videos; on-screen text and subtitles only | Agreed with Jordan; avoids a speech-to-text service | Transcribing audio |
| 2026-11-09 | Suggestions **in the app only**, no Slack | Agreed with Jordan | Slack digest |
| 2026-11-09 | Focus: **Meta insights + ad approval first**; Clients View, Onboarding, LeadLabz stay in Retool | Agreed with Jordan | Replacing everything at once |
| 2026-11-09 | **Retool bridge** (read-only copy every 15 min) for data still maintained in Retool | Avoids rebuilding GHL/Sheets syncs now; can't break Retool | Rebuilding those syncs in Phase 0 |
| 2026-11-09 | App lives **inside GHL** (sidebar) + direct link for phones; **GHL single sign-on** | Team already works in GHL; employees.id = GHL user id | Separate website only |
| 2026-11-09 | Host on **Cloudflare Pages** (free) instead of Vercel | Free for business use; app needs no server of its own | Vercel ($20/mo), Netlify, GitHub Pages |
| 2026-11-09 | **React + TypeScript + Vite + Tailwind** | Static app, fast, works on Cloudflare; Tailwind for responsive layouts | Next.js (needs a server host) |
| 2026-11-09 | **Supabase** (Postgres, Auth, Realtime, Edge Functions, Storage) | Same engine as Retool DB; logins, live updates and jobs in one service | Firebase, Airtable, Google Sheets |
| 2026-11-09 | **Meta System User token** | Doesn't expire like personal tokens (a likely cause of Retool breakage) | Personal access tokens |

## 2026-11-11: Look: G · Air, with light and dark mode

Jordan picked Air from the four sleeker options (Graphite, Onyx, Air, Studio) and asked for a dark mode. Air is now the default for everyone; dark mode follows the device unless someone chooses Light or Dark. The other looks were removed the same day at Jordan's request ([design-options.md](design-options.md)).

## 2026-11-11: First owners: Jordan and Trent

Jordan asked for Jordan Bosley and Trent Forrest to be owners. Set once directly in the database (nobody could use Settings → Staff before an owner existed) and recorded in `actions_log` (`staff.role`). Everyone else is staff; owners set other roles in Settings → Staff from now on.

## 2026-11-11: Client and staff changes can be made in The Lab

Jordan asked to move clients between ads managers, pause or remove clients, and remove staff from inside The Lab, without waiting on GHL or Retool. GHL is on hold and Retool is read-only from The Lab, so these are stored as **overrides in The Lab** that win over the copied values (migrations 2400, 2500), clearly marked "Changed in The Lab" and reversible. Sending them back to GHL (two-way) is planned once the GHL hold is lifted.

First uses, at Jordan's request on 11 Nov 2026:
- Moved to Zohirul: the four Rising Tide locations (Pikesville, Columbia, Finksburg, Timonium; the three RTA ad accounts linked and set Active) and Gracie Barra Renton, Tacoma and Marysville.
- Removed (Inactive): Overcome Jiu Jitsu Pinnacle, The Foundry BJJ, Campeao Acworth, Infinite Hitting Deerfield Beach, Storage-Tech, Bulls Jiu Jitsu, Apex Performance Center (Ashburn). Paused: Swampfox Jiu Jitsu.
- Removed from the team: Andres Hernandez (no longer an employee) and the "Dev MRKD" account. Team: Jordan, Trent (owners), Adam, Zohirul.

