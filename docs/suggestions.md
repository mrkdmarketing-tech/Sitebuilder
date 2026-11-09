# Suggestions

Per-ad-account suggestions shown **in the app only** (no Slack), e.g.:

> **Renzo Gracie Boca:** an ad has 1 lead at $120. Turn it off? **[Turn off] [Not now] [Dismiss]**

Code: [`shared/domain/rules.ts`](../shared/domain/rules.ts) (tests: `rules.test.ts`). Screen: `web/src/features/suggestions/`. Phase: **1b** (a preview with sample data is already in the app).

## Rules (agreed with Jordan, Nov 2026)

Evaluated over the **last 7 days**, only for Active/New clients and only for ads that are currently active.

| # | Rule | Fires when | Suggests | Severity |
|---|---|---|---|---|
| 1 | Expensive leads | CPL **> $50** with ≥ 1 lead | Turn off ad | High |
| 2 | Spending, no leads | **> $50** spent, 0 leads | Turn off ad | High |
| 3 | Budget hog | Ad has **≥ 60%** of its ad set's spend, spent ≥ $50, **and** CPL **> $80** or **≤ 2 leads**, and the ad set has other ads | Turn off ad so budget moves to the other ads (card lists the other ads' spend/leads/CPL) | High |
| 4 | Low CTR | CTR **< 0.8%** after ≥ 1,000 impressions | Refresh creative | Medium |
| 5 | Low link CTR | Link CTR **< 0.5%** after ≥ 1,000 impressions | Refresh creative / check offer | Medium |
| 6 | Account problem | Account not active, or UNSETTLED / IN_GRACE_PERIOD | Check billing / contact client | High |
| 7 | No recent leads | Active account with 0 leads in the last **3** days | Check campaigns | High |

**One suggestion per ad:** if an ad trips several rules, only the most important shows (order: account problem → budget hog → no leads → expensive → no recent leads → low link CTR → low CTR).

**Cards:** grouped per ad account, accounts with the most high-severity items first.

## Thresholds

Stored in `rule_settings` ([data-model.md](data-model.md#0400-suggestions)), editable by admins. Lookup order: **client override → ad type override → global → code defaults**. The CTR cutoffs (0.8% / 0.5%) and the 60% share are starting guesses to tune after a few weeks of real data.

## Lifecycle

```
open ──Turn off──▶ done        (ad paused in Meta, logged in actions_log)
open ──Not now───▶ snoozed ──(24h)──▶ open
open ──Dismiss───▶ dismissed
open ──condition clears on a later run──▶ resolved
```

The `run-rules` job runs after every Meta sync: it creates new suggestions, refreshes `last_seen_at` on existing ones, resolves ones that no longer apply, and reopens expired snoozes.

## "Turn off" safety

Handled by the `meta-action` function, not the browser:
1. Caller must be an active employee.
2. The suggestion must still be open.
3. Re-reads the ad from Meta; if it's already off, just marks it done.
4. Pauses the ad using the Meta System User token.
5. Writes `actions_log` (who, before/after, result).

Every "Turn off" asks for one confirmation first. In sample-data mode nothing is sent to Meta.

## Later

Claude adds a short plain-English reason and a creative idea per suggestion.
