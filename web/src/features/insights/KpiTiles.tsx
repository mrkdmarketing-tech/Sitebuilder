import { HIGHER_IS_BETTER, percentChange, type KpiSummary } from '@shared/domain/metrics.ts'
import { count, money, percent, signedPercent } from '../../lib/format'

/** The 8 KPI tiles from Retool's Meta Ads Insights, each compared with the previous period. */
const TILES: { key: keyof KpiSummary; label: string; fmt: (v: number | null) => string; neutral?: boolean }[] = [
  { key: 'activeAccounts', label: 'Active acc.', fmt: count },
  { key: 'leads', label: 'Leads', fmt: count },
  { key: 'cpl', label: 'CPL', fmt: (v) => money(v, { cents: true }) },
  { key: 'cpm', label: 'CPM', fmt: (v) => money(v, { cents: true }) },
  { key: 'cr', label: 'CR', fmt: (v) => percent(v) },
  { key: 'cpr', label: 'CPR', fmt: (v) => money(v, { cents: true }) },
  { key: 'cplc', label: 'CPLC', fmt: (v) => money(v, { cents: true }) },
  { key: 'valueGenerated', label: 'Value generated', fmt: (v) => money(v) },
]

export function KpiTiles({ current, previous, loading, activeCpl }: { current?: KpiSummary; previous?: KpiSummary; loading: boolean; activeCpl?: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {TILES.map((t) => {
        const value = current ? (current[t.key] as number | null) : null
        const prev = previous ? (previous[t.key] as number | null) : null
        const change = percentChange(value, prev)
        const good = change === null ? null : (change >= 0) === HIGHER_IS_BETTER[t.key]
        return (
          <div key={t.key} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="text-xs font-semibold text-muted">{t.label}</div>
            {t.key === 'cpl' && activeCpl !== undefined ? (
              <>
                {/* Overall CPL (light blue) and Active CPL (green), same colours as the tables. */}
                <div className={`kpi-value tabular mt-1 block w-fit rounded-md bg-overall-cpl px-1.5 text-xl font-bold ${loading ? 'animate-pulse text-gray-300' : ''}`}
                  title="Every ad that spent in this period, including ads since turned off">{t.fmt(value)}</div>
                <div className="tabular mt-1 block w-fit rounded-md bg-active-cpl px-1.5 text-[11px] text-soft" title="Cost per lead of the ads running now">
                  Active ads <b className="text-ink">{money(activeCpl, { cents: true })}</b>
                </div>
              </>
            ) : (
              <div className={`kpi-value tabular mt-1 text-xl font-bold ${loading ? 'animate-pulse text-gray-300' : ''}`}>{t.fmt(value)}</div>
            )}
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
