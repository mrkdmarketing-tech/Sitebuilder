# Documentation map

Everything about the MRKD platform is documented here. **Start with the row that matches what you want to know.**

## Where to start

| I want to… | Read |
|---|---|
| **Do a task in The Lab (step by step: daily check, Today, ad approval, Ad Studio, clients, staff, tokens)** | [sop/README.md](sop/README.md) |
| **See how everything is connected and where it all lives (services, secrets, jobs, data sources)** | [system-map.md](system-map.md) |
| **See what's waiting on whom** | [open-items.md](open-items.md) |
| Understand the project and its plan | [plan.md](plan.md) |
| See what Retool does today and what happens to each feature | [feature-checklist.md](feature-checklist.md) |
| See how Retool is built today (apps, workflows, tables) | [current-system.md](current-system.md) |
| Set up Supabase, Cloudflare and Meta (account owners) | [setup/accounts.md](setup/accounts.md) |
| Create the Meta app and token (full spec, forwardable) | [setup/meta.md](setup/meta.md) |
| Cloudflare build settings and Google sign-in setup | [setup/hosting-and-signin.md](setup/hosting-and-signin.md) |
| Run the app on my computer / run the tests | [development.md](development.md) |
| Know why something was decided | [decisions.md](decisions.md) |
| The look (Air, light and dark) | [design-options.md](design-options.md) |
| See what changed and when | [../CHANGELOG.md](../CHANGELOG.md) |
| Read the latest overnight / status update | [updates/](updates/2026-11-10-overnight.md) |

## How it works

| Topic | Doc |
|---|---|
| Architecture, folders, how data flows | [architecture.md](architecture.md) |
| Every database table and function | [data-model.md](data-model.md) |
| KPI formulas (CPL, CPM, CR %…) and how they match Retool | [metrics.md](metrics.md) |
| Suggestion rules, thresholds, "Turn off" actions | [suggestions.md](suggestions.md) |
| Ad approval: flow, mistake checks, Slack messages | [ad-approval.md](ad-approval.md) |
| Ad Studio: making ads in an approved style inside The Lab | [ad-studio.md](ad-studio.md) |
| Jev ad tags and Insights → What's working | [creative-tags.md](creative-tags.md) |
| GHL direct connection (read-only) | [ghl.md](ghl.md) |
| Client websites, SEO and AEO plan | [seo.md](seo.md) |
| Meta access for The Lab (what was missing, how to fix) | [setup/meta-access-checklist.md](setup/meta-access-checklist.md) |
| Background jobs (Meta sync, Retool bridge…) and schedules | [background-jobs.md](background-jobs.md) |
| Copying data from Retool while it's still in use | [retool-bridge.md](retool-bridge.md) |
| Logins, roles and who can see what | [auth.md](auth.md) |
| Security setup and two-step sign-in | [sop/security.md](sop/security.md) |
| Asking Claude about the data with your own login (planned) | [claude-connector.md](claude-connector.md) |

## Screens

| Screen | Doc | Replaces in Retool |
|---|---|---|
| Meta insights (Active CPL, tags, What's working, client status badge) | [screens/insights.md](screens/insights.md) | Meta Ads Insights |
| Today (home: what needs doing, Turn off, Undo) | [suggestions.md](suggestions.md#today-screen) | "Show alerts" |
| Ad approval (+ Create with a style) | [ad-approval.md](ad-approval.md), [ad-studio.md](ad-studio.md) | Ad Preview (+ making ads in a Claude chat) |
| Search (ad copy; lead forms need one more Meta permission) | [screens/insights.md#search](screens/insights.md#search) | Search Meta Lead Forms |
| Sync status | [background-jobs.md#sync-status-screen](background-jobs.md#sync-status-screen) | – |
| Settings (thresholds, staff, light/dark) | [sop/changing-thresholds.md](sop/changing-thresholds.md), [sop/staff-and-access.md](sop/staff-and-access.md) | – |
| Clients (status, ads manager, ad accounts; a tab on phones) | [sop/new-client-or-ad-account.md](sop/new-client-or-ad-account.md#changing-a-client-in-the-lab) | Parts of Clients View |

## Code map

```
README.md               Start page
CHANGELOG.md            What changed, by date
docs/                   ← you are here
  sop/                    Standard operating procedures (how to use and run The Lab)
  updates/                Dated status updates (what was done, what's needed)
shared/                 Code used by BOTH the app and the background jobs
  domain/types.ts         Data shapes (report rows, leads, employees…)
  domain/metrics.ts       KPI formulas — the only place they're calculated
  domain/dates.ts         Date presets (Last 7 days…), Toronto time zone
  domain/rules.ts         Suggestion rules engine
  domain/approvals.ts     Ad approval: statuses, placeholders, finding format
  domain/adChecks.ts      Built-in mistake checks (spelling, discipline, phone, address, dates…)
  domain/approvalSlack.ts Slack message text for ad approval
  domain/today.ts         Today screen wording, button and order
  domain/creativeTags.ts  Jev tag questions, labels, filters, summaries
  domain/styleKit.ts      Ad Studio: style definitions and house rules (Echo)
  domain/metaErrors.ts    Meta refusals in plain English (Turn off)
  domain/ghl.ts           Reading GHL contacts
  domain/siteCheck.ts     Client website check (SEO)
  meta/mapping.ts         Meta API → database row mapping
  **/*.test.ts            Unit tests
web/                    The app (React + TypeScript + Tailwind, built with Vite)
  src/app/                Routes, app shell (top bar / sidebar / phone tab bar), session (who's signed in, design)
  src/features/insights/  Meta insights screen
  src/features/today/     Today (home): suggestions as one quiet list
  src/features/approvals/ Ad approval: list, editor, mistake check, review
  src/features/studio/    Ad Studio ("Create with a style")
  src/features/search/    Lead form & ad copy search
  src/features/status/    Sync status
  src/features/settings/  Settings (thresholds, staff, light/dark)
  src/features/clients/   Clients: status, ads manager, ad accounts
  src/data/               Where screens get data: sample data or Supabase
  src/components/         Shared UI pieces
  src/lib/                Formatting, CSV, links, config, media previews, pyRender (Python in the browser for Ad Studio)
supabase/
  migrations/             Database setup, applied in order (0100 → 3400); what each adds: data-model.md
  functions/              Background jobs (Supabase Edge Functions); list and schedules: background-jobs.md
scripts/style-kit/      Loading a style from the MRKD style kit into The Lab
  seed.sql                Fictional sample data for local testing
  tests/                  Database tests (run against real Postgres)
```

## Keeping docs current

Every change updates the docs it affects **in the same commit**, plus a line in [CHANGELOG.md](../CHANGELOG.md). New decisions go in [decisions.md](decisions.md).
