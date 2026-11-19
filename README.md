# The Lab (MRKD Platform)

**The Lab** is MRKD Marketing's internal platform, replacing Retool. It lives inside MRKD's GoHighLevel sidebar, with a direct link for phones.

**What it does today:** Meta insights for every client (Active CPL next to CPL, Jev ad tags, What's working), **Today** (what needs doing, Turn off and Undo confirmed by Meta), **ad approval** with mistake checks and **Ad Studio** (make ads in an approved MRKD style), and client / staff controls. Clients View, Onboarding and the LeadLabz tools stay in Retool for now.

**Status:** live at https://sitebuilder-6iw.pages.dev on real data. What changed: [CHANGELOG.md](CHANGELOG.md). What's waiting: [docs/open-items.md](docs/open-items.md).

## Documentation

**[docs/README.md](docs/README.md) is the map of everything.** Main docs:

| | |
|---|---|
| [**SOPs**](docs/sop/README.md) | Step-by-step procedures for staff and admins |
| [**System map**](docs/system-map.md) | Every service, secret, job and data source, and how they connect |
| [**Open items**](docs/open-items.md) | What's waiting, on whom, and the steps |
| [Plan](docs/plan.md) | Architecture, modules, phases, costs, decisions still open |
| [Feature checklist](docs/feature-checklist.md) | Every Retool feature, line by line, and what happens to it |
| [Current Retool system](docs/current-system.md) | How Retool is built today |
| [Account setup](docs/setup/accounts.md) | Supabase, Cloudflare, Retool DB, Meta, GHL: step by step |
| [Design](docs/design-options.md) | The look (Air), light and dark mode |
| [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) · [KPI formulas](docs/metrics.md) | How it works |
| [Suggestions](docs/suggestions.md) · [Ad approval](docs/ad-approval.md) · [Ad Studio](docs/ad-studio.md) · [Ad tags](docs/creative-tags.md) · [GHL](docs/ghl.md) · [SEO](docs/seo.md) | Feature designs |
| [Background jobs](docs/background-jobs.md) · [Retool bridge](docs/retool-bridge.md) · [Auth](docs/auth.md) | Behind the scenes |
| [Development guide](docs/development.md) · [Decision log](docs/decisions.md) | For whoever works on the code |

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173, sample data mode
npm test           # unit tests
npm run db:test    # database tests (needs local PostgreSQL)
```

## Repo layout

```
web/        the app (React + TypeScript + Tailwind)
shared/     Rules used by both the app and the jobs: KPIs, dates, suggestions, mistake checks, tags, Ad Studio styles (all tested)
scripts/    Loading styles from the MRKD style kit
supabase/   database migrations, background jobs, seed data, database tests
docs/       documentation
```
