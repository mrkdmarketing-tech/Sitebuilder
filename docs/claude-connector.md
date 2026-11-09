# MRKD connector for Claude (planned)

Lets every employee ask Claude about MRKD's ad data **with their own Claude login**, e.g. "How are my accounts doing this week?" or "Which of my ads have leads over $50?". Claude only sees what that employee is allowed to see in the app.

Status: **planned**, after Phase 1a (needs the Supabase database with real data).

## How it works

```
Employee's Claude  →  MRKD connector (Supabase Edge Function, MCP)  →  Supabase database
                      signs the employee in with their MRKD login       same row-level security as the app
```

- **Connector:** a remote MCP server running as a Supabase Edge Function (`supabase/functions/mcp`).
- **Sign-in:** OAuth. The first time an employee uses it, Claude sends them to sign in with their MRKD login (Google). Their session is then used for every query, so the database applies the **same rules as the app**: staff see only their own suggestions, owners/admins see everything, non-employees see nothing ([auth.md](auth.md)).
- **Same numbers as the dashboard:** tools call the same `report()` functions and `shared/domain/metrics.ts` formulas.

## Tools (first version: read-only)

| Tool | Answers |
|---|---|
| `my_accounts` | Accounts assigned to me in GHL (or all, for owners) with KPIs for a date range |
| `report` | Accounts / campaigns / ad sets / ads with spend, leads, CPL, CPM, CR, CTR… for a date range and optional filters |
| `compare_periods` | A KPI for an account/campaign vs the previous period |
| `my_suggestions` | Open suggestions for my accounts |
| `leads` | Meta leads for a client and date range |
| `search_lead_forms`, `search_ad_copy` | Same as the Search screen |

Later, optionally: actions such as "turn off this ad", always with a confirmation step and written to `actions_log`.

## Rollout

1. Phase 1a finished (real data in Supabase).
2. Build the connector + OAuth sign-in; test with Jordan's account.
3. Add it to Claude: on a **Team/Enterprise** plan an owner adds it once for the organization (Settings → Connectors → custom connector, URL of the function); on individual paid plans each person adds it.
4. Each employee clicks **Connect** once and signs in.

## Today, without building anything

Each employee can enable Claude's **Meta Ads** connector and sign in with their own Facebook account. It answers questions about Meta numbers for the ad accounts their Facebook login can access, but has no GHL assignments, lead-sheet outcomes or suggestions.
