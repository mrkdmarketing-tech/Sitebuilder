# SOP: Changing suggestion thresholds

**Who:** owner or admin. **When:** suggestions are too noisy (people dismiss most of them) or too quiet (problems are missed). Review monthly for the first three months.

## Steps

1. Open **Settings** (owners and admins only; staff can view but not change).
2. Change the number, for example **Expensive leads: CPL above $50** to $60.
3. Click **Save**. The change applies on the next suggestion run (within 30 minutes). It's recorded who changed what and when.
4. Tell the ads managers in Slack what changed and why.

## What each setting does

| Setting | Agreed starting value | Rule |
|---|---|---|
| Expensive leads, CPL above | $50 | Ad with at least 1 lead costing more than this |
| Spending with no leads, above | $50 | Ad spent more than this with 0 leads |
| Budget hog, share of ad set spend | 60% | One ad takes this much of its ad set's spend... |
| Budget hog, CPL above | $80 | ...and has no leads or CPL above this |
| Low CTR, below | 0.8% | After the minimum impressions |
| Low link CTR, below | 0.5% | After the minimum impressions |
| Minimum impressions | 1,000 | CTR rules ignore ads below this |
| No recent leads, days | 3 | Active account with 0 leads for this many days |

All rules look at the **last 7 days**. Full rule details: [../suggestions.md](../suggestions.md).

## How to decide

- Look at the **Dismiss** rate: if most suggestions of one type are dismissed, that threshold is too tight.
- Change one setting at a time and give it a week.
- Write the reason in [../decisions.md](../decisions.md) if it's a lasting change.
