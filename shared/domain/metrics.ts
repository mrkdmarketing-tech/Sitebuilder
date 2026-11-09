/**
 * KPI formulas. This is the ONLY place derived metrics are calculated, for the
 * dashboard and for the suggestion rules, so numbers can never disagree.
 *
 * Every formula matches Retool's Meta Ads Insights app (verified against the
 * Nov 2026 export). Full reference with examples: docs/metrics.md.
 */
import type { ReportRow, Totals } from './types.ts'

export const EMPTY_TOTALS: Totals = Object.freeze({
  spend: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  linkClicks: 0,
  leads: 0,
  comments: 0,
  pageLikes: 0,
  messages: 0,
  booked: 0,
  shown: 0,
  closed: 0,
  closedValue: 0,
  valueGenerated: 0,
})

const TOTAL_KEYS = Object.keys(EMPTY_TOTALS) as (keyof Totals)[]

/** Adds up the raw totals of many rows. */
export function sumTotals(rows: readonly Totals[]): Totals {
  const out: Totals = { ...EMPTY_TOTALS }
  for (const row of rows) {
    for (const key of TOTAL_KEYS) out[key] += Number(row[key]) || 0
  }
  return out
}

/** Safe division: returns null instead of Infinity/NaN when there's nothing to divide by. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator)) return null
  const value = numerator / denominator
  return Number.isFinite(value) ? value : null
}

export interface DerivedMetrics {
  /** Cost per lead = spend ÷ leads. */
  cpl: number | null
  /** Cost per 1,000 impressions = spend ÷ impressions × 1000. */
  cpm: number | null
  /** Cost per 1,000 reach = spend ÷ reach × 1000. (Retool label: "CPR".) */
  cpr: number | null
  /** Cost per link click = spend ÷ link clicks. */
  cplc: number | null
  /** Conversion rate % = leads ÷ link clicks × 100. (Retool label: "CR %".) */
  cr: number | null
  /** Click-through rate % = clicks ÷ impressions × 100. */
  ctr: number | null
  /** Link click-through rate % = link clicks ÷ impressions × 100. */
  linkCtr: number | null
}

export function derive(t: Totals): DerivedMetrics {
  const pct = (n: number, d: number) => {
    const r = ratio(n, d)
    return r === null ? null : r * 100
  }
  const perThousand = (n: number, d: number) => {
    const r = ratio(n, d)
    return r === null ? null : r * 1000
  }
  return {
    cpl: ratio(t.spend, t.leads),
    cpm: perThousand(t.spend, t.impressions),
    cpr: perThousand(t.spend, t.reach),
    cplc: ratio(t.spend, t.linkClicks),
    cr: pct(t.leads, t.linkClicks),
    ctr: pct(t.clicks, t.impressions),
    linkCtr: pct(t.linkClicks, t.impressions),
  }
}

export interface KpiSummary extends DerivedMetrics {
  /** Ad accounts counted as active (ACTIVE, IN_GRACE_PERIOD or UNSETTLED). */
  activeAccounts: number
  leads: number
  spend: number
  valueGenerated: number
}

/**
 * The KPI tiles at the top of the insights screen.
 *
 * Mirrors Retool: "Active Acc." counts every account in the filtered list,
 * while the other tiles use only the rows the user has selected in the
 * accounts table (or all rows if nothing is selected).
 */
export function kpiSummary(
  accountRows: readonly ReportRow[],
  selectedIds: ReadonlySet<string> = new Set(),
): KpiSummary {
  const counted = selectedIds.size
    ? accountRows.filter((r) => selectedIds.has(r.id))
    : accountRows
  const totals = sumTotals(counted)
  return {
    ...derive(totals),
    activeAccounts: accountRows.filter((r) => r.accountActive).length,
    leads: totals.leads,
    spend: totals.spend,
    valueGenerated: totals.valueGenerated,
  }
}

/**
 * Percent change from `previous` to `current`, for the comparison under each
 * KPI tile. Null when there's no previous value to compare against.
 */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** For each KPI, whether a rise is good (green) or bad (red). */
export const HIGHER_IS_BETTER: Record<keyof KpiSummary, boolean> = {
  activeAccounts: true,
  leads: true,
  spend: true, // neutral really; shown without colour in the UI
  valueGenerated: true,
  cpl: false,
  cpm: false,
  cpr: false,
  cplc: false,
  cr: true,
  ctr: true,
  linkCtr: true,
}
