# Changelog

What changed, newest first. Every change to the platform adds a line here.

## 2026-11-09: Suggestions per employee + design options
- **Suggestions are per ads manager:** staff see and act on only the accounts assigned to them in GHL; owners/admins see everyone's with a filter. Enforced in the database (migration 0900) and tested; reassigning a client in GHL moves its open suggestions to the new manager.
- Insights opens on the ads manager's own accounts the first time.
- App knows who's signed in (`me()`), with initials in the top bar. Sample mode has a **"Viewing as"** switch to try it as different people.
- **Four design options** (A Classic, B Midnight, C MRKD Bold with sidebar, D Compact), switchable from the yellow bar or `?design=`; screenshots in [docs/design-options.md](docs/design-options.md). All colours are now design tokens.
- Fonts bundled with the app instead of Google Fonts.

## 2026-11-09: Skeleton build (Phase 0 groundwork, before accounts exist)

**App (`web/`)**
- React + TypeScript + Tailwind app with routes: Insights, Suggestions, Ad approval (placeholder), Search, Sync status. Top nav on desktop, bottom tab bar on phones.
- **Meta insights** screen with sample data: 8 KPI tiles with previous-period comparison, ads manager filter, date presets + custom range, Accounts / Campaigns / Ad sets / Ads / Leads tabs with counts, sortable tables (desktop) and cards (phone), account selection that filters KPIs and tabs, creative popup, Ads Manager links, CSV export, search.
- **Suggestions** preview: rules run on sample data, one card per ad account, Turn off / Not now / Dismiss (no changes sent anywhere in sample mode).
- **Search** for lead forms and ad copy. **Sync status** list.
- Sample data mode (fictional gyms, fixed seed) when Supabase isn't configured.

**Shared logic (`shared/`)**
- KPI formulas matching Retool, date presets in Toronto time, suggestion rules engine with the agreed thresholds, Meta API → table mapping. 44 unit tests.

**Database (`supabase/`)**
- 8 migrations: foundation (staff, clients, lookups, sync log, audit log), Meta tables with typed daily insights, Retool bridge tables, suggestions + thresholds, ad approval tables (reviews, assets, AI findings, checklist, comments, events, templates), reporting functions, row-level security on every table, private file bucket.
- Fictional seed data; database tests for report numbers and permissions (run on real Postgres).
- Background job skeletons: meta-sync, retool-bridge, run-rules, meta-action, ad-check.

**Docs**
- Documentation map, architecture, data model, KPI formulas, suggestions, ad approval, background jobs, Retool bridge, auth, development guide, account setup steps, decision log, insights screen.

## 2026-11-09: Plan agreed
- Focus on Meta insights + ad approval first; Clients View, Onboarding and LeadLabz stay in Retool (read via the Retool bridge).
- Suggestion thresholds agreed. Ad approval: manual uploads, AI check of copy / image text / video subtitles, "Hey, just double checking" soft warning; no audio check; suggestions in-app only.
- Hosting: Cloudflare Pages + Supabase; app embedded in GHL with GHL single sign-on.

## 2026-11-08: Retool audit
- Exported and documented all 47 Retool apps, 32 workflows and the database ([current-system.md](docs/current-system.md), [feature-checklist.md](docs/feature-checklist.md)).
