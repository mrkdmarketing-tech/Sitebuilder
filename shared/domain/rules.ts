/**
 * Suggestion rules engine (plan.md M2, docs/suggestions.md).
 *
 * Pure function: takes report rows and settings, returns suggestions. The
 * background job runs it after every Meta sync and stores the results; the
 * sample-data mode runs it in the browser. Same code either way.
 *
 * Thresholds were agreed with Jordan in Nov 2026 and are editable in the app
 * (DEFAULT_RULE_SETTINGS is only the starting point).
 */
import { derive } from './metrics.ts'
import type { ReportRow } from './types.ts'

export type RuleKey =
  | 'budget_hog'
  | 'no_leads_spend'
  | 'expensive_cpl'
  | 'low_link_ctr'
  | 'low_ctr'
  | 'account_issue'
  | 'no_recent_leads'

export interface RuleSettings {
  /** Rule 1: flag an ad whose cost per lead is above this ($), with at least 1 lead. */
  expensiveCpl: number
  /** Rule 2: flag an ad that spent more than this ($) with 0 leads. */
  noLeadSpend: number
  /** Rule 3: an ad is a budget hog if it has at least this share (0–1) of its ad set's spend
   * and either no leads or a cost per lead above budgetHogCpl. */
  budgetHogShare: number
  /** Rule 3: cost per lead ($) above which a dominant ad is flagged. */
  budgetHogCpl: number
  /** Rule 4: CTR below this % is low. */
  lowCtr: number
  /** Rule 5: link CTR below this % is low. */
  lowLinkCtr: number
  /** Rules 4–5 only judge ads with at least this many impressions. */
  minImpressions: number
  /** Rule 7: an active client with 0 leads over this many days. */
  noRecentLeadsDays: number
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = Object.freeze({
  expensiveCpl: 50,
  noLeadSpend: 50,
  budgetHogShare: 0.6,
  budgetHogCpl: 80,
  lowCtr: 0.8,
  lowLinkCtr: 0.5,
  minImpressions: 1000,
  noRecentLeadsDays: 3,
})

export type Severity = 'high' | 'medium'

export type SuggestedAction =
  | { type: 'pause_ad'; adId: string }
  | { type: 'review_creative'; adId: string }
  | { type: 'check_account'; accountId: string }

export interface Suggestion {
  /** Stable key so the same problem isn't suggested twice: `${rule}:${entityId}`. */
  key: string
  rule: RuleKey
  severity: Severity
  accountId: string
  accountName: string
  clientId: number | null
  clientName: string | null
  managerId: string | null
  level: 'account' | 'ad'
  entityId: string
  entityName: string
  /** One plain sentence describing the problem. */
  message: string
  /** The question on the action button's card, e.g. "Turn it off?". */
  question: string
  action: SuggestedAction
  /** Numbers behind the suggestion, shown on the card and stored for audit. */
  evidence: Record<string, number | string | null>
  /** For budget hogs: the other ads in the same ad set. */
  siblings?: { id: string; name: string; spend: number; leads: number; cpl: number | null }[]
}

export interface RuleInput {
  /** Ad-level rows for the evaluation window (default: last 7 days). */
  ads: readonly ReportRow[]
  /** Account-level rows for the evaluation window. */
  accounts: readonly ReportRow[]
  /** Meta leads per account over the last `noRecentLeadsDays` days. */
  recentLeadsByAccount: ReadonlyMap<string, number>
  settings?: Partial<RuleSettings>
}

const PRIORITY: RuleKey[] = [
  'account_issue',
  'budget_hog',
  'no_leads_spend',
  'expensive_cpl',
  'no_recent_leads',
  'low_link_ctr',
  'low_ctr',
]

const money = (n: number) => `$${n.toFixed(n >= 100 ? 0 : 2).replace(/\.00$/, '')}`
/** Percent with 2 decimals, or 3 when 2 would round up to look equal to the threshold. */
const pct = (n: number, threshold?: number) =>
  threshold !== undefined && Number(n.toFixed(2)) >= threshold ? `${n.toFixed(3)}%` : `${n.toFixed(2)}%`
const leadsText = (n: number) => `${n} lead${n === 1 ? '' : 's'}`

/** Clients the rules apply to (same filter as Retool's insights: Active or New). */
function isLiveClient(row: ReportRow): boolean {
  return row.clientStatus === 'Active' || row.clientStatus === 'New'
}

function base(row: ReportRow, rule: RuleKey, level: 'account' | 'ad') {
  return {
    key: `${rule}:${row.id}`,
    rule,
    accountId: row.accountId,
    accountName: row.accountName,
    clientId: row.clientId,
    clientName: row.clientName,
    managerId: row.managerId,
    level,
    entityId: row.id,
    entityName: row.name,
  }
}

export function evaluateRules(input: RuleInput): Suggestion[] {
  const s: RuleSettings = { ...DEFAULT_RULE_SETTINGS, ...input.settings }
  const found: Suggestion[] = []

  // ---- Account-level rules -------------------------------------------------
  for (const acc of input.accounts) {
    if (!isLiveClient(acc)) continue

    // Rule 6: account disabled, unsettled or with a payment problem.
    const label = acc.statusLabel.toUpperCase()
    if (!acc.accountActive || label === 'UNSETTLED' || label === 'IN_GRACE_PERIOD') {
      found.push({
        ...base(acc, 'account_issue', 'account'),
        severity: 'high',
        message: `Ad account is ${label.replace(/_/g, ' ').toLowerCase()}, so ads may not be running.`,
        question: 'Check billing or contact the client?',
        action: { type: 'check_account', accountId: acc.accountId },
        evidence: { status: label },
      })
      continue
    }

    // Rule 7: live client, active account, no leads recently.
    const recent = input.recentLeadsByAccount.get(acc.accountId) ?? 0
    if (recent === 0) {
      found.push({
        ...base(acc, 'no_recent_leads', 'account'),
        severity: 'high',
        message: `No leads in the last ${s.noRecentLeadsDays} days.`,
        question: 'Check the campaigns?',
        action: { type: 'check_account', accountId: acc.accountId },
        evidence: { days: s.noRecentLeadsDays, leads: 0 },
      })
    }
  }

  // ---- Ad-level rules ------------------------------------------------------
  const live = input.ads.filter((a) => isLiveClient(a) && a.status === 'ACTIVE')

  // Ad set spend totals for the budget-hog rule (include paused siblings that
  // still spent in the window, so the share is honest).
  const adsetSpend = new Map<string, number>()
  const adsetAds = new Map<string, ReportRow[]>()
  for (const ad of input.ads) {
    if (!ad.adsetId) continue
    adsetSpend.set(ad.adsetId, (adsetSpend.get(ad.adsetId) ?? 0) + ad.spend)
    adsetAds.set(ad.adsetId, [...(adsetAds.get(ad.adsetId) ?? []), ad])
  }

  for (const ad of live) {
    const m = derive(ad)
    const candidates: Suggestion[] = []

    // Rule 3: budget hog.
    const siblings = (ad.adsetId ? adsetAds.get(ad.adsetId) ?? [] : []).filter((x) => x.id !== ad.id)
    const setSpend = ad.adsetId ? adsetSpend.get(ad.adsetId) ?? 0 : 0
    const share = setSpend > 0 ? ad.spend / setSpend : 0
    if (
      siblings.length > 0 &&
      share >= s.budgetHogShare &&
      ad.spend >= s.noLeadSpend &&
      // Agreed with Jordan: "an ad that has 1 lead or 2 at over $80-100". So a
      // dominant ad is only a problem with no leads, or leads costing over $80.
      (ad.leads === 0 || (m.cpl !== null && m.cpl > s.budgetHogCpl))
    ) {
      candidates.push({
        ...base(ad, 'budget_hog', 'ad'),
        severity: 'high',
        message:
          `${ad.name} took ${Math.round(share * 100)}% of its ad set's spend (${money(ad.spend)}) ` +
          (ad.leads === 0
            ? 'with no leads.'
            : `for ${leadsText(ad.leads)} at ${money(m.cpl ?? 0)} each.`),
        question: 'Turn it off so the budget moves to the other ads?',
        action: { type: 'pause_ad', adId: ad.id },
        evidence: { spend: ad.spend, leads: ad.leads, cpl: m.cpl, share },
        siblings: siblings.map((x) => ({
          id: x.id,
          name: x.name,
          spend: x.spend,
          leads: x.leads,
          cpl: derive(x).cpl,
        })),
      })
    }

    // Rule 2: spending with no leads.
    if (ad.leads === 0 && ad.spend > s.noLeadSpend) {
      candidates.push({
        ...base(ad, 'no_leads_spend', 'ad'),
        severity: 'high',
        message: `${ad.name} spent ${money(ad.spend)} with no leads.`,
        question: 'Turn it off?',
        action: { type: 'pause_ad', adId: ad.id },
        evidence: { spend: ad.spend, leads: 0 },
      })
    }

    // Rule 1: expensive leads.
    if (ad.leads >= 1 && m.cpl !== null && m.cpl > s.expensiveCpl) {
      candidates.push({
        ...base(ad, 'expensive_cpl', 'ad'),
        severity: 'high',
        message: `${ad.name} has ${leadsText(ad.leads)} at ${money(m.cpl)} each.`,
        question: 'Turn it off?',
        action: { type: 'pause_ad', adId: ad.id },
        evidence: { spend: ad.spend, leads: ad.leads, cpl: m.cpl },
      })
    }

    // Rules 4–5: weak click-through (only with enough impressions to judge).
    if (ad.impressions >= s.minImpressions) {
      if (m.linkCtr !== null && m.linkCtr < s.lowLinkCtr) {
        candidates.push({
          ...base(ad, 'low_link_ctr', 'ad'),
          severity: 'medium',
          message: `${ad.name} has a low link CTR of ${pct(m.linkCtr, s.lowLinkCtr)} (under ${pct(s.lowLinkCtr)}).`,
          question: 'Refresh the creative or check the offer?',
          action: { type: 'review_creative', adId: ad.id },
          evidence: { linkCtr: m.linkCtr, impressions: ad.impressions },
        })
      }
      if (m.ctr !== null && m.ctr < s.lowCtr) {
        candidates.push({
          ...base(ad, 'low_ctr', 'ad'),
          severity: 'medium',
          message: `${ad.name} has a low CTR of ${pct(m.ctr, s.lowCtr)} (under ${pct(s.lowCtr)}).`,
          question: 'Refresh the creative?',
          action: { type: 'review_creative', adId: ad.id },
          evidence: { ctr: m.ctr, impressions: ad.impressions },
        })
      }
    }

    // One suggestion per ad: the most important one.
    if (candidates.length) {
      candidates.sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule))
      found.push(candidates[0])
    }
  }

  return found
}

export interface AccountSuggestions {
  accountId: string
  accountName: string
  clientName: string | null
  managerId: string | null
  suggestions: Suggestion[]
}

/** Groups suggestions into one overview card per ad account, most urgent first. */
export function groupByAccount(suggestions: readonly Suggestion[]): AccountSuggestions[] {
  const map = new Map<string, AccountSuggestions>()
  for (const sug of suggestions) {
    const g =
      map.get(sug.accountId) ??
      map
        .set(sug.accountId, {
          accountId: sug.accountId,
          accountName: sug.accountName,
          clientName: sug.clientName,
          managerId: sug.managerId,
          suggestions: [],
        })
        .get(sug.accountId)!
    g.suggestions.push(sug)
  }
  const score = (g: AccountSuggestions) =>
    g.suggestions.filter((x) => x.severity === 'high').length * 10 + g.suggestions.length
  for (const g of map.values()) {
    g.suggestions.sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule))
  }
  return [...map.values()].sort((a, b) => score(b) - score(a))
}
