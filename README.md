# MRKD Platform

MRKD Marketing's internal platform, replacing Retool. It lives inside MRKD's GoHighLevel sidebar, with a direct link for phones.

**Being built now:** Meta insights (every Retool KPI, on phone and desktop), per-account suggestions ("an ad has 1 lead at $120: turn it off?"), and ad approval with an AI check of copy, images and video subtitles. Clients View, Onboarding and the LeadLabz tools stay in Retool for now.

**Status:** skeleton built and tested with sample data. Waiting on account setup ([docs/setup/accounts.md](docs/setup/accounts.md)). See [CHANGELOG.md](CHANGELOG.md).

## 📚 Documentation

**[docs/README.md](docs/README.md) is the map of everything.** Main docs:

| | |
|---|---|
| [Plan](docs/plan.md) | Architecture, modules, phases, costs, decisions still open |
| [Feature checklist](docs/feature-checklist.md) | Every Retool feature, line by line, and what happens to it |
| [Current Retool system](docs/current-system.md) | How Retool is built today |
| [Account setup](docs/setup/accounts.md) | Supabase, Cloudflare, Retool DB, Meta, GHL: step by step |
| [**Design options**](docs/design-options.md) | 4 looks to pick from, with screenshots |
| [Architecture](docs/architecture.md) · [Data model](docs/data-model.md) · [KPI formulas](docs/metrics.md) | How it works |
| [Suggestions](docs/suggestions.md) · [Ad approval](docs/ad-approval.md) | Feature designs |
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
shared/     KPI formulas, date presets, suggestion rules, Meta mapping (used by app + jobs)
supabase/   database migrations, background jobs, seed data, database tests
docs/       documentation
```
