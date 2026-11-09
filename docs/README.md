# Documentation map

Everything about the MRKD platform is documented here. **Start with the row that matches what you want to know.**

## Where to start

| I want to… | Read |
|---|---|
| Understand the project and its plan | [plan.md](plan.md) |
| See what Retool does today and what happens to each feature | [feature-checklist.md](feature-checklist.md) |
| See how Retool is built today (apps, workflows, tables) | [current-system.md](current-system.md) |
| Set up Supabase, Cloudflare and Meta (account owners) | [setup/accounts.md](setup/accounts.md) |
| Run the app on my computer / run the tests | [development.md](development.md) |
| Know why something was decided | [decisions.md](decisions.md) |
| **Pick a design (4 options with screenshots)** | [design-options.md](design-options.md) |
| See what changed and when | [../CHANGELOG.md](../CHANGELOG.md) |

## How it works

| Topic | Doc |
|---|---|
| Architecture, folders, how data flows | [architecture.md](architecture.md) |
| Every database table and function | [data-model.md](data-model.md) |
| KPI formulas (CPL, CPM, CR %…) and how they match Retool | [metrics.md](metrics.md) |
| Suggestion rules, thresholds, "Turn off" actions | [suggestions.md](suggestions.md) |
| Ad approval and the AI quality check (Phase 2) | [ad-approval.md](ad-approval.md) |
| Background jobs (Meta sync, Retool bridge…) and schedules | [background-jobs.md](background-jobs.md) |
| Copying data from Retool while it's still in use | [retool-bridge.md](retool-bridge.md) |
| Logins, roles and who can see what | [auth.md](auth.md) |

## Screens

| Screen | Doc | Replaces in Retool |
|---|---|---|
| Meta insights | [screens/insights.md](screens/insights.md) | Meta Ads Insights |
| Suggestions | [suggestions.md](suggestions.md) | "Show alerts" |
| Ad approval | [ad-approval.md](ad-approval.md) | Ad Preview 🤖 |
| Search | [screens/insights.md#search](screens/insights.md#search) | Search Meta Lead Forms |
| Sync status | [background-jobs.md#sync-status-screen](background-jobs.md#sync-status-screen) | – |

## Code map

```
README.md               Start page
CHANGELOG.md            What changed, by date
docs/                   ← you are here
shared/                 Code used by BOTH the app and the background jobs
  domain/types.ts         Data shapes (report rows, leads, employees…)
  domain/metrics.ts       KPI formulas — the only place they're calculated
  domain/dates.ts         Date presets (Last 7 days…), Toronto time zone
  domain/rules.ts         Suggestion rules engine
  meta/mapping.ts         Meta API → database row mapping
  **/*.test.ts            Unit tests
web/                    The app (React + TypeScript + Tailwind, built with Vite)
  src/app/                Routes, app shell (top bar / sidebar / phone tab bar), session (who's signed in, design)
  src/features/insights/  Meta insights screen
  src/features/suggestions/ Suggestions screen
  src/features/approvals/ Ad approval (Phase 2 placeholder)
  src/features/search/    Lead form & ad copy search
  src/features/status/    Sync status
  src/data/               Where screens get data: sample data or Supabase
  src/components/         Shared UI pieces
  src/lib/                Formatting, CSV, links, config
supabase/
  migrations/             Database setup, applied in order (0100 → 0800)
  functions/              Background jobs (Supabase Edge Functions)
  seed.sql                Fictional sample data for local testing
  tests/                  Database tests (run against real Postgres)
```

## Keeping docs current

Every change updates the docs it affects **in the same commit**, plus a line in [CHANGELOG.md](../CHANGELOG.md). New decisions go in [decisions.md](decisions.md).
