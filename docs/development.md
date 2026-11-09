# Development guide

## Requirements

- Node.js 20+ (22 recommended)
- For database tests: PostgreSQL 15+ command-line tools (`initdb`, `pg_ctl`, `psql`)
- Later, for deploying: the Supabase CLI

## Run the app locally

```bash
npm install          # once, from the repo root
npm run dev          # http://localhost:5173
```

With no Supabase settings, the app runs in **sample data mode** (yellow banner, fictional gyms). To use the real database, copy `web/.env.example` to `web/.env.local` and fill in the Supabase URL and anon key.

## Commands (from the repo root)

| Command | Does |
|---|---|
| `npm run dev` | Start the app with hot reload |
| `npm run build` | Type-check and build to `web/dist/` |
| `npm test` | Unit tests (formulas, dates, rules, Meta mapping, CSV) |
| `npm run typecheck` | TypeScript check only |
| `npm run db:test` | Spin up a throwaway Postgres, apply every migration + `seed.sql`, run the SQL tests |

All of these must pass before pushing.

## Database tests

`supabase/tests/run-local.sh` creates a temporary Postgres, applies `tests/supabase-stub.sql` (stand-ins for Supabase's `auth` schema and roles), every file in `supabase/migrations/`, then `supabase/seed.sql`, then each `tests/*.test.sql`. Tests are `DO` blocks with `assert`; any failure stops the run.

- `report.test.sql`: report numbers for the seed data (spend, leads, outcomes, filters, status).
- `retool_bridge.test.sql`: the Retool bridge against a fake Retool database (`retool-fake.sql`, same table names as the real one): copies, links, duplicate emails, deletions, permissions.
- `security.test.sql`: RLS on every table; anon / stranger / staff / owner permissions.

## Project layout

See the code map in [docs/README.md](README.md#code-map) and [architecture.md](architecture.md).

## Adding things

| To add… | Do |
|---|---|
| A KPI | Formula in `shared/domain/metrics.ts` + test; column in `web/src/features/insights/columns.tsx`; document in [metrics.md](metrics.md) |
| A suggestion rule | Rule in `shared/domain/rules.ts` + tests; threshold default in `DEFAULT_RULE_SETTINGS` **and** the `rule_settings` seed (new migration); document in [suggestions.md](suggestions.md) |
| A table or column | New migration file (never edit an applied one) with RLS policies; update `seed.sql`/tests if relevant; document in [data-model.md](data-model.md) |
| A screen | Folder under `web/src/features/`, route in `web/src/app/App.tsx`, nav item in `Layout.tsx`; get data only via `useData()` |
| A data method | Add to `DataSource` in `web/src/data/source.ts` and implement in **both** `mockSource.ts` and `supabaseSource.ts` |

## Conventions

**Style (Jordan's preference, Nov 2026): simple and organised.**
- **No emojis** anywhere: not in the app, labels, messages, docs or commit messages. Use plain words.
- Icons only where they help navigation (the thin line icons in the menu and buttons), never decoration.
- Short, plain labels. One idea per screen section. Consistent order and spacing.


- TypeScript `strict`. No `any` unless unavoidable and commented.
- `shared/` stays dependency-free and uses `.ts` import extensions (Deno compatibility).
- Number formatting only via `web/src/lib/format.ts`.
- Docs and [CHANGELOG.md](../CHANGELOG.md) are updated in the same commit as the change.
