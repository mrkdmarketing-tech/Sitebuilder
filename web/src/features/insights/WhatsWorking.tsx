/**
 * Insights -> What's working (docs/creative-tags.md). Cost per lead by what the
 * ads offer, who they speak to, how they open, and image vs video, across every
 * Active/New client. Tags come from TypeSafe's Jev (tag-creatives); format from Meta.
 */
import { TAG_QUESTIONS, tagLabel } from '@shared/domain/creativeTags.ts'
import type { DateRange } from '@shared/domain/types.ts'
import { useData, type CreativeTagRow } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { money } from '../../lib/format'

const DIMENSIONS: { key: CreativeTagRow['dimension']; label: string }[] = [
  ...TAG_QUESTIONS.map((q) => ({ key: q.key, label: q.label })),
  { key: 'format', label: 'Format' },
]

export function WhatsWorking({ range }: { range: DateRange }) {
  const ds = useData()
  const { data, loading, error } = useAsync(() => ds.creativeTagReport(range), [ds, range.from, range.to])
  if (error) return <p className="p-4 text-sm text-bad">Couldn't load: {error.message}</p>
  if (!data) return <p className="p-6 text-center text-sm text-muted">{loading ? 'Loading...' : ''}</p>

  const all = data.filter((r) => r.dimension === 'format')
  const totalSpend = all.reduce((s, r) => s + r.spend, 0)
  const totalLeads = all.reduce((s, r) => s + r.leads, 0)
  const avg = totalLeads ? totalSpend / totalLeads : null
  const untagged = data.find((r) => r.dimension === 'offer' && r.value === null)
  const taggedShare = totalSpend ? 1 - (untagged?.spend ?? 0) / totalSpend : 0

  return (
    <div className="space-y-5 p-4">
      <p className="text-sm text-muted">
        Every Active and New client's lead-campaign ads that spent in this period (sales campaigns are left out), grouped by what the ad says. Average cost per lead: <b className="text-ink">{money(avg)}</b>.
        {taggedShare === 0
          ? ' Offer, audience and opening hook appear once the hourly tagging has run (it needs the TypeSafe key).'
          : taggedShare < 0.95 && ` ${Math.round(taggedShare * 100)}% of spend is on tagged ads so far; the rest are tagged hour by hour.`}
        {' '}Lower cost per lead than average is shown in green. Few ads or few accounts means the number may be luck.
      </p>
      {DIMENSIONS.map((d) => {
        const rows = data.filter((r) => r.dimension === d.key && (r.value !== null || d.key === 'format'))
        if (!rows.length) return null
        return (
          <section key={d.key}>
            <h3 className="mb-1.5 text-sm font-semibold">{d.label}</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-subtle text-left text-xs text-muted">
                  <tr>
                    <th className="w-[40%] px-3 py-2 font-medium">{d.label}</th>
                    <th className="px-3 py-2 text-right font-medium">Cost per lead</th>
                    <th className="px-3 py-2 text-right font-medium">Leads</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Ads</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Accounts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const cpl = r.leads ? r.spend / r.leads : null
                    const better = cpl !== null && avg !== null && cpl < avg * 0.9
                    const worse = cpl === null ? r.spend > 0 : avg !== null && cpl > avg * 1.1
                    const thin = r.ads < 5 || r.accounts < 3
                    return (
                      <tr key={r.value ?? 'none'} className="border-t border-line">
                        <td className="px-3 py-2">{tagLabel(d.key, r.value)}{thin && <span className="ml-1.5 text-xs text-muted">(few ads)</span>}</td>
                        <td className={`tabular px-3 py-2 text-right font-semibold ${better ? 'text-good' : worse ? 'text-bad' : ''}`}>{cpl === null ? 'No leads' : money(cpl)}</td>
                        <td className="tabular px-3 py-2 text-right">{r.leads.toLocaleString()}</td>
                        <td className="tabular px-3 py-2 text-right">{money(r.spend)}</td>
                        <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{r.ads}</td>
                        <td className="tabular hidden px-3 py-2 text-right sm:table-cell">{r.accounts}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
