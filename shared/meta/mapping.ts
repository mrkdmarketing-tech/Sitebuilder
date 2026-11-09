/**
 * Turns Meta Marketing API responses into our table rows (supabase/migrations/0200).
 * Pure functions, no network: used by supabase/functions/meta-sync and unit-tested.
 * Action types match what Retool used, so totals agree (docs/metrics.md).
 */

/** Meta's numeric account_status → the label we store. */
export const ACCOUNT_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
  201: 'ANY_ACTIVE',
  202: 'ANY_CLOSED',
}

export function accountStatusLabel(code: number | string | null | undefined): string {
  const n = Number(code)
  return ACCOUNT_STATUS[n] ?? 'UNKNOWN'
}

/** Which Meta action_type feeds each of our columns. */
export const ACTION_COLUMNS = {
  link_clicks: 'link_click',
  leads: 'lead',
  comments: 'comment',
  page_likes: 'like',
  messages: 'onsite_conversion.messaging_conversation_started_7d',
} as const

export interface MetaAction {
  action_type: string
  value: string | number
}

/** One row of GET /act_{id}/insights?level=ad&time_increment=1 */
export interface MetaInsightRow {
  ad_id: string
  adset_id: string
  campaign_id: string
  account_id: string
  date_start: string
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  actions?: MetaAction[]
}

export interface InsightDbRow {
  ad_id: string
  date: string
  account_id: string
  campaign_id: string
  adset_id: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  link_clicks: number
  leads: number
  comments: number
  page_likes: number
  messages: number
  actions: Record<string, number>
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function actionsToMap(actions: MetaAction[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of actions ?? []) out[a.action_type] = (out[a.action_type] ?? 0) + num(a.value)
  return out
}

export function mapInsightRow(row: MetaInsightRow): InsightDbRow {
  const actions = actionsToMap(row.actions)
  return {
    ad_id: row.ad_id,
    date: row.date_start,
    account_id: row.account_id,
    campaign_id: row.campaign_id,
    adset_id: row.adset_id,
    spend: num(row.spend),
    impressions: num(row.impressions),
    reach: num(row.reach),
    clicks: num(row.clicks),
    link_clicks: actions[ACTION_COLUMNS.link_clicks] ?? 0,
    leads: actions[ACTION_COLUMNS.leads] ?? 0,
    comments: actions[ACTION_COLUMNS.comments] ?? 0,
    page_likes: actions[ACTION_COLUMNS.page_likes] ?? 0,
    messages: actions[ACTION_COLUMNS.messages] ?? 0,
    actions,
  }
}

/**
 * Meta returns budgets in the currency's minor unit as strings ("3000" = $30.00).
 * (Zero-decimal currencies such as JPY aren't used by MRKD clients.)
 */
export function budgetFromMinor(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  return num(value) / 100
}

/** Strips the "act_" prefix Meta uses on ad account ids. */
export function bareAccountId(id: string): string {
  return id.startsWith('act_') ? id.slice(4) : id
}

/** Advantage+ audience flag from ad set targeting. */
export function isAdvantagePlus(targeting: Record<string, unknown> | null | undefined): boolean {
  const auto = (targeting?.targeting_automation ?? {}) as Record<string, unknown>
  return Number(auto.advantage_audience) === 1
}

/** Meta genders array ([1] male, [2] female, missing = all) → label. */
export function gendersLabel(genders: number[] | null | undefined): string {
  if (!genders || genders.length === 0 || genders.length === 2) return 'All'
  return genders[0] === 1 ? 'Male' : 'Female'
}
