# KPI formulas

Every KPI on the insights screen, how it's calculated, and how it matches Retool's **Meta Ads Insights** app (checked against the Nov 2026 export).

Code: [`shared/domain/metrics.ts`](../shared/domain/metrics.ts). Tests: [`shared/domain/metrics.test.ts`](../shared/domain/metrics.test.ts).

## Raw totals (summed from daily data)

| Total | Source (Meta Insights API, per ad per day) |
|---|---|
| Spend | `spend` |
| Impressions | `impressions` |
| Reach | `reach` (summed across days, see limitations) |
| Clicks | `clicks` (all clicks) |
| Link clicks | action `link_click` |
| Leads | action `lead` |
| Comments | action `comment` |
| Page likes | action `like` |
| Messages | action `onsite_conversion.messaging_conversation_started_7d` |
| Booked / Shown / Closed / Closed value | Client lead sheets (via Retool bridge): booked = appointment status set, shown = "Shown", closed = shown with a closed value |
| Value generated | Lead sheets: closed value + whole months as a member × monthly membership (Retool Clients View formula) |

These are the same action types Retool used ([`shared/meta/mapping.ts`](../shared/meta/mapping.ts)).

## Derived KPIs

| KPI | Formula | Retool label |
|---|---|---|
| **CPL** | spend ÷ leads | CPL |
| **CPM** | spend ÷ impressions × 1,000 | CPM |
| **CPR** | spend ÷ reach × 1,000 | CPR |
| **CPLC** | spend ÷ link clicks | CPLC |
| **CR %** | leads ÷ link clicks × 100 | CR |
| **CTR** | clicks ÷ impressions × 100 | CTR |
| **Link CTR** | link clicks ÷ impressions × 100 | Link CTR |
| **Active acc.** | number of ad accounts whose status is ACTIVE, IN_GRACE_PERIOD or UNSETTLED | Active Acc. ⚡ |
| **Value generated** | sum of value generated (above) | Value Generated |

When the bottom number is 0 (e.g. CPL with no leads) the KPI shows **—**, not $0 or ∞.

## Behaviour that matches Retool

- **Only Active and New clients** are included (Retool filtered `active_status in ('Active','New')`).
- **Selecting accounts** in the Ad accounts table recalculates the KPI tiles for just those accounts. "Active acc." still counts every account in view. *(New: the other tabs also filter to the selected accounts.)*
- **Status:** a campaign/ad set/ad is ACTIVE only if it and all its parents are active and the account is active.
- **Previous period** for the comparison under each tile: the same number of days immediately before the selected range (Nov 1–6 compares with Oct 26–31).
- **Date presets:** "Last 7/14/30 days" end yesterday; weeks start Monday.
- **Lead outcomes** (booked/shown/closed) are matched to campaigns, ad sets and ads **by name**, because that's all the lead sheets record.

## Differences from Retool (improvements)

| Retool | New app |
|---|---|
| "Today" = UTC − 4 hours (wrong for half the year, during standard time) | Real America/Toronto time, daylight saving included |
| Previous-period comparison | Every tile shows % change vs the previous period, green/red by whether up is good |
| Data could be hours old (chained syncs) | Synced every 30 min; "Data updated X min ago" shown |

## Known limitations

These are the same in Retool. They're listed so nobody is surprised.

1. **Reach is summed across days.** Someone reached on Monday and again on Tuesday counts twice, so CPR over multi-day ranges is lower than Ads Manager's de-duplicated number. Fix later by also storing Meta's period-level reach.
2. **Mixed currencies are added together.** USD and CAD accounts are summed as-is in "All managers" totals.
3. **Name-matched outcomes.** If two ads in the same client share a name, their lead-sheet outcomes are counted for both.
4. **A client with two ad accounts** shows its lead-sheet outcomes on each account.
