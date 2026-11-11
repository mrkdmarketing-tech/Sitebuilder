/**
 * The Today screen's wording and order (docs/suggestions.md#today-screen).
 * Turns a suggestion into one short plain sentence, picks the single button
 * shown on the row, and sorts the list (most urgent and most money first).
 * Shared so the wording can be tested and reused (e.g. in emails later).
 */
import type { Suggestion } from './rules.ts'

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const money = (n: number) => `$${n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2).replace(/\.00$/, '')}`
const pct = (n: number) => `${n < 1 ? n.toFixed(2) : n.toFixed(1)}%`

/** One short sentence for the row, e.g. "An ad spent $240 with no leads". */
export function todayLine(s: Pick<Suggestion, 'rule' | 'evidence'>): string {
  const e = s.evidence ?? {}
  const spend = num(e.spend)
  const leads = num(e.leads)
  const cpl = num(e.cpl)
  switch (s.rule) {
    case 'no_leads_spend':
      return spend !== null ? `An ad spent ${money(spend)} with no leads` : 'An ad is spending with no leads'
    case 'expensive_cpl':
      return cpl !== null ? `An ad is costing ${money(cpl)} a lead` : 'An ad has expensive leads'
    case 'budget_hog': {
      const share = num(e.share)
      const part = share !== null ? `${Math.round(share * 100)}% of its ad set's budget` : "most of its ad set's budget"
      return leads === 0 || cpl === null ? `One ad is taking ${part} with no leads` : `One ad is taking ${part} at ${money(cpl)} a lead`
    }
    case 'low_link_ctr': {
      const v = num(e.linkCtr)
      return v !== null ? `Few people click an ad's link (${pct(v)})` : "Few people click an ad's link"
    }
    case 'low_ctr': {
      const v = num(e.ctr)
      return v !== null ? `Few people click an ad (${pct(v)})` : 'Few people click an ad'
    }
    case 'account_issue': {
      const status = typeof e.status === 'string' ? e.status.replace(/_/g, ' ').toLowerCase() : 'not active'
      return `Ad account is ${status}, ads may not be running`
    }
    case 'no_recent_leads': {
      const days = num(e.days)
      return `No leads in the last ${days ?? 3} days`
    }
    default:
      return 'Needs a look'
  }
}

export type TodayButton = 'turn_off' | 'open_ad' | 'open_billing' | 'open_account'

/** The one button on the row. Everything else is in the row's details. */
export function primaryButton(s: Pick<Suggestion, 'rule' | 'level' | 'action'>): TodayButton {
  if (s.action.type === 'pause_ad') return 'turn_off'
  if (s.rule === 'account_issue') return 'open_billing'
  if (s.level === 'ad') return 'open_ad'
  return 'open_account'
}

/** Ad-level suggestions can be turned off from the details, whatever the rule. */
export const canTurnOff = (s: Pick<Suggestion, 'level' | 'action'>) =>
  s.level === 'ad' && !!(s.action as { adId?: string }).adId

/** Most urgent first, then the most money spent. */
export function todayOrder<T extends Pick<Suggestion, 'severity' | 'evidence'>>(list: T[]): T[] {
  const rank = (s: T) => (s.severity === 'high' ? 0 : 1)
  return [...list].sort((a, b) => rank(a) - rank(b) || (num(b.evidence?.spend) ?? 0) - (num(a.evidence?.spend) ?? 0))
}

/** "Good morning" etc. in Toronto time. */
export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', hour12: false, timeZone: 'America/Toronto' }).format(now)) % 24
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export interface TodayGroup<T> {
  accountId: string
  /** Client (location) name, or the ad account name if no client is linked. */
  name: string
  items: T[]
}

/**
 * One group per location (ad account), items inside in todayOrder. Groups with
 * an urgent item first, then the most money spent across the group.
 */
export function groupToday<T extends Pick<Suggestion, 'accountId' | 'accountName' | 'clientName' | 'severity' | 'evidence'>>(list: T[]): TodayGroup<T>[] {
  const by = new Map<string, TodayGroup<T>>()
  for (const s of list) {
    const g = by.get(s.accountId) ?? { accountId: s.accountId, name: s.clientName ?? s.accountName, items: [] }
    g.items.push(s)
    by.set(s.accountId, g)
  }
  const spend = (g: TodayGroup<T>) => g.items.reduce((n, s) => n + (num(s.evidence?.spend) ?? 0), 0)
  const urgent = (g: TodayGroup<T>) => (g.items.some((s) => s.severity === 'high') ? 0 : 1)
  return [...by.values()]
    .map((g) => ({ ...g, items: todayOrder(g.items) }))
    .sort((a, b) => urgent(a) - urgent(b) || spend(b) - spend(a) || a.name.localeCompare(b.name))
}
