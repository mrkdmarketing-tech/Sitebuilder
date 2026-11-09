# Decision log

Why things are the way they are. Newest first. Add an entry whenever a real choice is made.

| Date | Decision | Why | Alternatives considered |
|---|---|---|---|
| 2026-11-09 | **Simple and organised style, no emojis** in the app or docs; plain labels, line icons only for navigation | Jordan's preference | Emoji labels as in Retool |
| 2026-11-09 | **Suggestions per employee**: staff see only accounts assigned to them in GHL; owners/admins see all; enforced by RLS | Requested by Jordan | Everyone sees everything with a filter |
| 2026-11-09 | **Four design options** (Classic, Midnight, MRKD Bold, Compact) switchable via design tokens; pick one later | Requested by Jordan | Committing to one look now |
| 2026-11-09 | **Fonts bundled** with the app (Inter, Space Grotesk) | No third-party requests; works in GHL iframe and offline | Google Fonts |
| 2026-11-09 | **Shared rules/formula code** in `shared/`, used by app and jobs | One formula per KPI; suggestions and dashboard can't disagree | Duplicating logic in SQL and TypeScript |
| 2026-11-09 | Database returns **raw totals**; KPIs computed in TypeScript | Single source of truth for formulas (see above), easy to test | Computing CPL etc. in SQL |
| 2026-11-09 | **Sample data mode** when Supabase isn't configured | Lets Jordan/Trent review screens before accounts exist; makes local dev easy | Waiting for real data |
| 2026-11-09 | Selecting accounts also **filters the other tabs** | Natural drill-down; Retool only recalculated KPIs | Retool's behaviour only |
| 2026-11-09 | Suggestion thresholds: CPL > $50, > $50 no leads, budget hog ≥ 60% share & > $80 CPL or ≤ 2 leads, CTR < 0.8%, link CTR < 0.5% | Agreed with Jordan; CTR and 60% values are starting points to tune | – |
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
