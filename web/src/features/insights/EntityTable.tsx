import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, FileSpreadsheet } from 'lucide-react'
import type { Level, ReportRow } from '@shared/domain/types.ts'
import { adsManagerUrl } from '../../lib/links'
import { ClientBadge, Empty, ManagerChip, StatusBadge } from '../../components/ui'
import { columnsFor, metricsOf, type Column } from './columns'

export type SortState = { key: string; dir: 'asc' | 'desc' }

export function sortRows(rows: ReportRow[], columns: Column[], sort: SortState): ReportRow[] {
  const col = columns.find((c) => c.key === sort.key)
  if (!col) return rows
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = col.value(a, metricsOf(a))
    const vb = col.value(b, metricsOf(b))
    if (va === null || va === undefined) return 1 // blanks last either way
    if (vb === null || vb === undefined) return -1
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sign
  })
}

/** Desktop table for one level. Accounts can be selected (filters KPIs and the other tabs). */
export function EntityTable({
  level, rows, selected, onToggle, onToggleAll, onOpenCreative,
}: {
  level: Level
  rows: ReportRow[]
  selected: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: () => void
  onOpenCreative: (row: ReportRow) => void
}) {
  const columns = useMemo(() => columnsFor(level), [level])
  const [sort, setSort] = useState<SortState>({ key: 'spend', dir: 'desc' })
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort])
  const selectable = level === 'account' && !!onToggle
  if (!rows.length) return <Empty>Nothing to show for these filters.</Empty>

  const header = (c: Column) => (
    <th
      key={c.key}
      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-semibold ${c.numeric ? 'text-right' : 'text-left'} ${c.secondary ? 'hidden 2xl:table-cell' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {c.label}
        {sort.key === c.key && (sort.dir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </span>
    </th>
  )

  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full text-sm">
        <thead className="sticky top-0 bg-subtle text-xs text-muted">
          <tr className="border-b border-line">
            {selectable && (
              <th className="w-8 px-3 py-2">
                <input type="checkbox" aria-label="Select all" checked={selected.size > 0 && selected.size === rows.length} onChange={onToggleAll} />
              </th>
            )}
            {level === 'ad' && <th className="px-3 py-2" />}
            <th className="px-3 py-2 text-left font-semibold">{{ account: 'Account', campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' }[level]}</th>
            <th className="px-3 py-2 text-left font-semibold">Ads manager</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            {columns.map(header)}
            {level === 'account' && <th className="px-3 py-2 text-left font-semibold">Leads sheet</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const m = metricsOf(r)
            return (
              <tr key={r.id} className={`border-b border-line/70 hover:bg-hover ${selected.has(r.id) ? 'bg-selected' : ''}`}>
                {selectable && (
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => onToggle!(r.id)} />
                  </td>
                )}
                {level === 'ad' && (
                  <td className="px-3 py-1.5">
                    <button onClick={() => onOpenCreative(r)} className="block h-10 w-10 overflow-hidden rounded-md bg-subtle" aria-label="View creative">
                      {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                    </button>
                  </td>
                )}
                <td className="max-w-[320px] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <a href={adsManagerUrl(level, r.accountId, r.id)} target="_blank" rel="noreferrer" className="truncate font-medium text-brand hover:underline" title={r.name}>
                      {r.name}
                    </a>
                    <ExternalLink size={12} className="shrink-0 text-muted" />
                    {level === 'account' && <ClientBadge status={r.clientStatus} />}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {level === 'account'
                      ? [r.clientName && r.clientName !== r.name ? r.clientName : null, r.clientId ? `Client #${r.clientId}` : 'No client linked'].filter(Boolean).join(' · ')
                      : [r.accountName, level !== 'campaign' ? r.campaignName : null, level === 'ad' ? r.adsetName : null].filter(Boolean).join(' › ')}
                  </div>
                </td>
                <td className="px-3 py-2"><ManagerChip name={r.managerName} /></td>
                <td className="px-3 py-2"><StatusBadge status={r.status} label={level === 'account' ? r.statusLabel : undefined} /></td>
                {columns.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${c.numeric ? 'text-right' : ''} ${c.secondary ? 'hidden 2xl:table-cell' : ''}`}>
                    {c.render ? c.render(r, m) : (c.value(r, m) ?? '—')}
                  </td>
                ))}
                {level === 'account' && (
                  <td className="px-3 py-2">
                    {r.leadsSheetUrl ? (
                      <a href={r.leadsSheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                        <FileSpreadsheet size={14} /> Open
                      </a>
                    ) : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
