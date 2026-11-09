import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import type { Level, ReportRow } from '@shared/domain/types.ts'
import { adsManagerUrl } from '../../lib/links'
import { count, money, percent } from '../../lib/format'
import { ClientBadge, Empty, ManagerChip, StatusBadge } from '../../components/ui'
import { columnsFor, metricsOf } from './columns'

/** Phone layout: one card per row with the headline numbers; tap for everything else. */
export function EntityCards({
  level, rows, selected, onToggle, onOpenCreative,
}: {
  level: Level
  rows: ReportRow[]
  selected: Set<string>
  onToggle?: (id: string) => void
  onOpenCreative: (row: ReportRow) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!rows.length) return <Empty>Nothing to show for these filters.</Empty>
  const columns = columnsFor(level)
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const m = metricsOf(r)
        const open = expanded === r.id
        return (
          <li key={r.id} className={`px-3 py-3 ${selected.has(r.id) ? 'bg-blue-50/60' : ''}`}>
            <div className="flex gap-3">
              {level === 'ad' && (
                <button onClick={() => onOpenCreative(r)} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100" aria-label="View creative">
                  {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{r.name}</span>
                      {level === 'account' && <ClientBadge status={r.clientStatus} />}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {level === 'account'
                        ? [r.clientName && r.clientName !== r.name ? r.clientName : null, r.clientId ? `Client #${r.clientId}` : 'No client linked'].filter(Boolean).join(' · ')
                        : [r.accountName, level !== 'campaign' ? r.campaignName : null].filter(Boolean).join(' › ')}
                    </div>
                  </div>
                  <StatusBadge status={r.status} label={level === 'account' ? r.statusLabel : undefined} />
                </div>
                <div className="tabular mt-2 grid grid-cols-4 gap-2 text-center">
                  <Stat label="Spend" value={money(r.spend)} />
                  <Stat label="Leads" value={count(r.leads)} />
                  <Stat label="CPL" value={money(m.cpl, { cents: true })} />
                  <Stat label="CR" value={percent(m.cr, 1)} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <ManagerChip name={r.managerName} />
                  <div className="flex items-center gap-3">
                    {level === 'account' && onToggle && (
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} /> Select
                      </label>
                    )}
                    <button onClick={() => setExpanded(open ? null : r.id)} className="flex items-center gap-0.5 text-xs font-medium text-brand">
                      {open ? 'Less' : 'More'} <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-2 rounded-lg bg-gray-50 p-2">
                    <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {columns.map((c) => (
                        <div key={c.key} className="flex justify-between gap-2">
                          <dt className="text-muted">{c.label}</dt>
                          <dd className="font-medium">{c.render ? c.render(r, m) : (c.value(r, m) ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                    <a href={adsManagerUrl(level, r.accountId, r.id)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand">
                      Open in Ads Manager <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 py-1">
      <div className="text-[10px] font-medium uppercase text-muted">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}
