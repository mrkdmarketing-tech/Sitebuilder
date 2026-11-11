# Suggestions

Per-ad-account suggestions shown **in the app only** (no Slack), **to the employee each account is assigned to in GHL**, e.g.:

> **Renzo Gracie Boca:** an ad has 1 lead at $120. Turn it off? **[Turn off] [Not now] [Dismiss]**

Code: [`shared/domain/rules.ts`](../shared/domain/rules.ts) (tests: `rules.test.ts`). Screen: **Today** (`web/src/features/today/`, wording in `shared/domain/today.ts`). Jobs: `run-rules` (saves suggestions every 30 min, at :10 and :40) and `meta-action` (Turn off). **Live since 10 Nov 2026.** First run: 38 suggestions (Adam 16, Jordan 13, Zohirul 9).

## Who sees which suggestions

Each client's ads manager is the **"Assigned to" user on the client's contact in MRKD's GHL**. The Retool bridge copies it into `clients.ad_manager_id` (an employee's id *is* their GHL user id), and every suggestion is stamped with that `manager_id`.

| Person | Sees | Can act on |
|---|---|---|
| Ads manager (`staff`) | **Only suggestions for accounts assigned to them in GHL.** The page says "Alex, you look after 4 ad accounts (assigned in GHL)" | Only their own |
| Owner / admin | Everyone's, with an ads-manager filter | Everyone's |

This is **enforced in the database** (migration 0900, row-level security), not just hidden in the app; tested in `supabase/tests/security.test.sql`. If a client is **reassigned in GHL**, its open suggestions move to the new ads manager on the next bridge run (database trigger).

The Insights screen also starts on the ads manager's own accounts the first time they open it; they can switch to other managers or "All" there.

## Rules (agreed with Jordan, Nov 2026)

Evaluated over the **last 7 days**, only for Active/New clients and only for ads that are currently active.

| # | Rule | Fires when | Suggests | Severity |
|---|---|---|---|---|
| 1 | Expensive leads | CPL **> $50** with ≥ 1 lead | Turn off ad | High |
| 2 | Spending, no leads | **> $50** spent, 0 leads | Turn off ad | High |
| 3 | Budget hog | Ad has **≥ 60%** of its ad set's spend, spent ≥ $50, **and** either **no leads** or CPL **> $80**, and the ad set has other ads (tightened 10 Nov 2026: 2 leads at $35 is not a problem) | Turn off ad so budget moves to the other ads (card lists the other ads' spend/leads/CPL) | High |
| 4 | Low CTR | CTR **< 0.8%** after ≥ 1,000 impressions | Refresh creative | Medium |
| 5 | Low link CTR | Link CTR **< 0.5%** after ≥ 1,000 impressions | Refresh creative / check offer | Medium |
| 6 | Account problem | Account not active, or UNSETTLED / IN_GRACE_PERIOD | Check billing / contact client | High |
| 7 | No recent leads | Active account with 0 leads in the last **3** days | Check campaigns | High |

**One suggestion per ad:** if an ad trips several rules, only the most important shows (order: account problem → budget hog → no leads → expensive → no recent leads → low link CTR → low CTR).

## Today screen

Since 11 Nov 2026 suggestions are shown on **Today**, The Lab's home page (it replaced the Suggestions page; the old address redirects). Designed to be quiet so one ads manager can handle 40+ accounts:

- A greeting and one sentence: "**6 things** need you today. Your other 34 accounts are fine."
- **One list, one row per item**: account, one plain sentence (`todayLine` in `shared/domain/today.ts`, e.g. "An ad spent $240 with no leads"), and **one button** (`primaryButton`: Turn off for the pause rules, Open billing for account problems, Open in Ads Manager for the rest). Most urgent first, then most money spent (`todayOrder`).
- An **X** on every row dismisses it in one tap (hidden for 7 days), with **Undo** in the message (sets it back to open).
- **Tap a row** for the numbers and the other options: Turn off (any ad's row), Open in Ads Manager, Not now, Dismiss.
- **Undo** for 24 hours after a Turn off (message, and the "Recently turned off" list).
- Sidebar badge with the number waiting. Owners/admins choose Everyone, Mine or one ads manager.
- How staff use it: [sop/acting-on-suggestions.md](sop/acting-on-suggestions.md).

## Thresholds

Stored in `rule_settings` ([data-model.md](data-model.md#0400-suggestions)). Owners and admins change them on the **Settings** screen (everyone else sees them read-only); every change is logged ([sop/changing-thresholds.md](sop/changing-thresholds.md)). Lookup order: **client override → ad type override → global → code defaults**. The CTR cutoffs (0.8% / 0.5%) and the 60% share are starting guesses to tune after a few weeks of real data.

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
2. The suggestion must still be open, and be about an ad (any ad-level rule, not only the pause rules).
3. Re-reads the ad from Meta; if it's already off, just marks it done.
4. Pauses the ad using the Meta System User token.
5. Writes `actions_log` (who, before/after, result).

Every "Turn off" asks for one confirmation first. In sample-data mode nothing is sent to Meta.

**Undo** (`{ suggestionId, undo: true }`): only within 24 hours of a Turn off made from The Lab, only if the ad is still paused; sets it back to active, logs `meta.resume_ad`, and marks the suggestion dismissed (not suggested again for 7 days). Each log entry stores the suggestion id so Undo can find it.

**Which accounts can be turned off:** the system user needs **Manage campaigns** on the ad account. On 10 Nov 2026, 32 of 54 accounts had it; the other 22 are view-only (list in [setup/meta.md](setup/meta.md)). On those, Turn off shows: "This ad account only lets The Lab view, not change ads…" with a link to Ads Manager.

**Seeing what happened:** after Turn off, a message confirms it with **Undo** and a link to check in Ads Manager, and **Recently turned off** at the bottom of Today shows every attempt (ad, account, who, when, Turned off / Already off / Turned back on / Failed) from `actions_log`.

**Not now** hides it for 24 hours. **Dismiss** stops it being suggested again for 7 days (if the problem is still there after that, it comes back).

## Later

Claude adds a short plain-English reason and a creative idea per suggestion.
