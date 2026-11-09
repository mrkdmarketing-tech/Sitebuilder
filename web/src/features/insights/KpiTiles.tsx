import { HIGHER_IS_BETTER, percentChange, type KpiSummary } from '@shared/domain/metrics.ts'
import { count, money, percent, signedPercent } from '../../lib/format'

/** The 8 KPI tiles from Retool's Meta Ads Insights, each compared with the previous period. */
const TILES: { key: keyof KpiSummary; label: string; emoji: string; fmt: (v: number | null) => string; neutral?: boolean }[] = [
  { key: 'activeAccounts', label: 'Active acc.', emoji: '⚡', fmt: count },
  { key: 'leads', label: 'Leads', emoji: '🎯', fmt: count },
  { key: 'cpl', label: 'CPL', emoji: '💸', fmt: (v) => money(v, { cents: true }) },
  { key: 'cpm', label: 'CPM', emoji: '😮', fmt: (v) => money(v, { cents: true }) },
  { key: 'cr', label: 'CR', emoji: '👥', fmt: (v) => percent(v) },
  { key: 'cpr', label: 'CPR', emoji: '📣', fmt: (v) => money(v, { cents: true }) },
  { key: 'cplc', label: 'CPLC', emoji: '🔗', fmt: (v) => money(v, { cents: true }) },
  { key: 'valueGenerated', label: 'Value generated', emoji: '💵', fmt: (v) => money(v) },
]

export function KpiTiles({ current, previous, loading }: { current?: KpiSummary; previous?: KpiSummary; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {TILES.map((t) => {
        const value = current ? (current[t.key] as number | null) : null
        const prev = previous ? (previous[t.key] as number | null) : null
        const change = percentChange(value, prev)
        const good = change === null ? null : (change >= 0) === HIGHER_IS_BETTER[t.key]
        return (
          <div key={t.key} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="flex items-center gap-1 text-xs font-semibold text-muted">
              <span aria-hidden>{t.emoji}</span>
              {t.label}
            </div>
            <div className={`kpi-value tabular mt-1 text-xl font-bold ${loading ? 'animate-pulse text-gray-300' : ''}`}>{t.fmt(value)}</div>
            <div className="tabular mt-0.5 h-4 text-[11px]">
              {change !== null && Math.abs(change) >= 0.5 && (
                <span className={good ? 'text-good' : 'text-bad'}>
                  {signedPercent(change)} <span className="text-muted">vs prev. period</span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
