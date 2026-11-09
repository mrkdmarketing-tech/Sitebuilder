/**
 * Column definitions for each insights tab. Mirrors Retool's Meta Ads Insights
 * tables (docs/feature-checklist.md §1), with Spend / Leads / CPL first.
 * Every value comes from shared/domain/metrics.ts.
 */
import type { ReactNode } from 'react'
import { derive, type DerivedMetrics } from '@shared/domain/metrics.ts'
import type { Level, ReportRow } from '@shared/domain/types.ts'
import { count, money, percent } from '../../lib/format'

export interface Column {
  key: string
  label: string
  /** Value used for sorting and CSV. */
  value: (r: ReportRow, m: DerivedMetrics) => number | string | null | undefined
  /** How it looks in the table (defaults to value). */
  render?: (r: ReportRow, m: DerivedMetrics) => ReactNode
  numeric?: boolean
  /** Hidden on narrow desktop widths to keep the table readable. */
  secondary?: boolean
}

const num = (key: string, label: string, value: Column['value'], fmt: (v: number | null) => string, secondary = false): Column => ({
  key, label, numeric: true, secondary, value,
  render: (r, m) => fmt((value(r, m) as number | null) ?? null),
})

export const METRIC_COLUMNS: Column[] = [
  num('spend', 'Spend', (r) => r.spend, (v) => money(v)),
  num('leads', 'Leads', (r) => r.leads, count),
  num('cpl', 'CPL', (_, m) => m.cpl, (v) => money(v, { cents: true })),
  num('cpm', 'CPM', (_, m) => m.cpm, (v) => money(v, { cents: true })),
  num('cpr', 'CPR', (_, m) => m.cpr, (v) => money(v, { cents: true }), true),
  num('cplc', 'CPLC', (_, m) => m.cplc, (v) => money(v, { cents: true })),
  num('cr', 'CR %', (_, m) => m.cr, (v) => percent(v)),
  num('impressions', 'Impressions', (r) => r.impressions, count, true),
  num('reach', 'Reach', (r) => r.reach, count, true),
  num('linkClicks', 'Link clicks', (r) => r.linkClicks, count),
  num('clicks', 'Clicks', (r) => r.clicks, count, true),
]

export const OUTCOME_COLUMNS: Column[] = [
  num('booked', 'Booked', (r) => r.booked, count),
  num('shown', 'Shown', (r) => r.shown, count),
  num('closed', 'Closed', (r) => r.closed, count),
  num('closedValue', 'Closed value', (r) => r.closedValue, (v) => money(v)),
]

const AD_EXTRA: Column[] = [
  num('ctr', 'CTR', (_, m) => m.ctr, (v) => percent(v)),
  num('linkCtr', 'Link CTR', (_, m) => m.linkCtr, (v) => percent(v)),
  num('comments', 'Comments', (r) => r.comments, count, true),
  num('pageLikes', 'Page likes', (r) => r.pageLikes, count, true),
  num('messages', 'Messages', (r) => r.messages, count, true),
]

const text = (key: string, label: string, value: Column['value'], secondary = false): Column => ({ key, label, value, secondary })

export const LEVEL_EXTRA: Record<Level, Column[]> = {
  account: [],
  campaign: [
    num('dailyBudget', 'Daily budget', (r) => r.dailyBudget ?? null, (v) => money(v)),
    text('objective', 'Objective', (r) => r.objective?.replace('OUTCOME_', ''), true),
    text('bidStrategy', 'Bid strategy', (r) => r.bidStrategy?.replace(/_/g, ' ').toLowerCase(), true),
    text('buyingType', 'Buying type', (r) => r.buyingType, true),
    text('pacingType', 'Pacing', (r) => r.pacingType, true),
  ],
  adset: [
    text('genders', 'Genders', (r) => r.genders, true),
    text('age', 'Age', (r) => (r.ageMin ? `${r.ageMin}–${r.ageMax ?? '65+'}` : null), true),
    text('optimizationGoal', 'Optimization', (r) => r.optimizationGoal?.replace(/_/g, ' ').toLowerCase(), true),
    text('advantagePlus', 'ADV+', (r) => (r.advantagePlus === null || r.advantagePlus === undefined ? null : r.advantagePlus ? 'Yes' : 'No'), true),
    text('learningStage', 'Learning', (r) => r.learningStage?.toLowerCase(), true),
  ],
  ad: AD_EXTRA,
}

/** Columns shown for a level, after the name/status columns. */
export function columnsFor(level: Level): Column[] {
  return [...METRIC_COLUMNS, ...LEVEL_EXTRA[level], ...OUTCOME_COLUMNS]
}

export function metricsOf(r: ReportRow): DerivedMetrics {
  return derive(r)
}
