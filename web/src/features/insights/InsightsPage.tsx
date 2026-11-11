/**
 * Meta insights (Phase 1a). Replaces Retool's "Meta Ads Insights".
 * Layout and behaviour: docs/screens/insights.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search, X } from 'lucide-react'
import { kpiSummary } from '@shared/domain/metrics.ts'
import { presetRange, previousRange, type PresetKey } from '@shared/domain/dates.ts'
import type { DateRange, Level, MetaLead, ReportRow } from '@shared/domain/types.ts'
import { useData } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { downloadCsv, toCsv } from '../../lib/csv'
import { Card, PageTitle } from '../../components/ui'
import { useSession } from '../../app/session'
import { SAMPLE_MODE } from '../../lib/config'
import { KpiTiles } from './KpiTiles'
import { DateRangeFilter, ManagerFilter } from './Filters'
import { EntityTable } from './EntityTable'
import { EntityCards } from './EntityCards'
import { LeadsList } from './LeadsList'
import { CreativeModal } from './CreativeModal'
import { WhatsWorking } from './WhatsWorking'
import { columnsFor, metricsOf } from './columns'

type Tab = Level | 'leads' | 'working'
const TABS: { key: Tab; label: string }[] = [
  { key: 'account', label: 'Ad accounts' },
  { key: 'campaign', label: 'Campaigns' },
  { key: 'adset', label: 'Ad sets' },
  { key: 'ad', label: 'Ads' },
  { key: 'leads', label: 'Leads' },
  { key: 'working', label: "What's working" },
]

// Remembered per browser (a convenience only; safe if storage is unavailable).
const STORE_KEY = 'mrkd.insights.v1'
function loadPrefs(): { preset?: PresetKey; managers?: string[] } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function savePrefs(p: { preset: PresetKey | 'custom'; managers: string[] }) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ preset: p.preset === 'custom' ? undefined : p.preset, managers: p.managers }))
  } catch {
    /* ignore */
  }
}

interface LevelData {
  account: ReportRow[]
  campaign: ReportRow[]
  adset: ReportRow[]
  ad: ReportRow[]
  leads: MetaLead[]
}

export function InsightsPage() {
  const ds = useData()
  const prefs = useMemo(loadPrefs, [])
  const [preset, setPreset] = useState<PresetKey | 'custom'>(prefs.preset ?? 'last_7_days')
  const [range, setRange] = useState<DateRange>(() => presetRange(prefs.preset ?? 'last_7_days'))
  const [managers, setManagers] = useState<string[]>(prefs.managers ?? [])
  const [tab, setTab] = useState<Tab>('account')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [creativeRow, setCreativeRow] = useState<ReportRow | null>(null)

  useEffect(() => savePrefs({ preset, managers }), [preset, managers])

  // First visit: an ads manager starts on their own accounts (assigned in GHL);
  // owners/admins start on everyone. After that, their own choice is remembered.
  const { me, isAdmin } = useSession()
  useEffect(() => {
    // (In sample mode this also re-runs when you switch "Viewing as".)
    if (!me || (prefs.managers !== undefined && !SAMPLE_MODE)) return
    setManagers(!isAdmin && me.isAdManager ? [me.id] : [])
  }, [me, isAdmin, prefs.managers])

  const { data: employees } = useAsync(() => ds.employees(), [ds])
  const adManagers = useMemo(() => (employees ?? []).filter((e) => e.isAdManager && e.active), [employees])

  // New numbers arrive every 30 min; reload automatically when a sync finishes.
  const live = useLiveRefresh(['meta.sync', 'retool_bridge'])

  const current = useAsync<LevelData>(async () => {
    const [account, campaign, adset, ad, leads] = await Promise.all([
      ds.report('account', range), ds.report('campaign', range), ds.report('adset', range), ds.report('ad', range), ds.leads(range),
    ])
    return { account, campaign, adset, ad, leads }
  }, [ds, range.from, range.to, live])
  const previous = useAsync(() => ds.report('account', previousRange(range)), [ds, range.from, range.to, live])
  const { data: lastUpdated } = useAsync(() => ds.lastUpdated(), [ds, current.data])

  // Filters: ads manager → selected accounts → search text.
  const byManager = useCallback(
    <T extends { managerId: string | null }>(rows: T[]) => (managers.length ? rows.filter((r) => r.managerId && managers.includes(r.managerId)) : rows),
    [managers],
  )
  const q = query.trim().toLowerCase()
  const matches = (r: ReportRow) =>
    !q || [r.name, r.accountName, r.clientName, r.campaignName, r.adsetName].some((v) => v?.toLowerCase().includes(q))

  const filtered = useMemo(() => {
    const d = current.data
    if (!d) return null
    const inSelection = (r: { accountId: string | null }) => selected.size === 0 || (r.accountId !== null && selected.has(r.accountId))
    return {
      account: byManager(d.account).filter(matches),
      campaign: byManager(d.campaign).filter(inSelection).filter(matches),
      adset: byManager(d.adset).filter(inSelection).filter(matches),
      ad: byManager(d.ad).filter(inSelection).filter(matches),
      leads: byManager(d.leads).filter(inSelection).filter((l) => !q || [l.name, l.email, l.adName, l.formName].some((v) => v?.toLowerCase().includes(q))),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.data, byManager, selected, q])

  // KPIs follow Retool: all accounts for "Active acc.", selected accounts (if any) for the rest.
  const kpis = useMemo(() => (current.data ? kpiSummary(byManager(current.data.account), selected) : undefined), [current.data, byManager, selected])
  const prevKpis = useMemo(() => (previous.data ? kpiSummary(byManager(previous.data), selected) : undefined), [previous.data, byManager, selected])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSelected((s) => (s.size === (filtered?.account.length ?? 0) ? new Set() : new Set(filtered?.account.map((r) => r.id))))

  const exportCsv = () => {
    if (!filtered || tab === 'working') return
    const stamp = `${range.from}_${range.to}`
    if (tab === 'leads') {
      downloadCsv(`leads_${stamp}.csv`, toCsv(['Created', 'Name', 'Email', 'Phone', 'Form', 'Ad'],
        filtered.leads.map((l) => [l.createdAt, l.name, l.email, l.phone, l.formName, l.adName])))
      return
    }
    const cols = columnsFor(tab)
    const rows = filtered[tab]
    downloadCsv(`${tab}s_${stamp}.csv`, toCsv(
      ['Name', 'Account', 'Client', 'Ads manager', 'Status', ...cols.map((c) => c.label)],
      rows.map((r) => [r.name, r.accountName, r.clientName, r.managerName, r.statusLabel, ...cols.map((c) => c.value(r, metricsOf(r)) as string | number | null)]),
    ))
  }

  const selectedNames = current.data?.account.filter((r) => selected.has(r.id)).map((r) => r.name) ?? []
  const rows = tab !== 'leads' && tab !== 'working' && filtered ? filtered[tab] : []

  return (
    <div>
      <PageTitle
        title="Meta insights"
        subtitle={lastUpdated ? `Data updated ${minutesAgo(lastUpdated)}` : undefined}
        right={
          <div className="flex flex-wrap gap-2">
            <ManagerFilter managers={adManagers} selected={managers} onChange={setManagers} />
            <DateRangeFilter range={range} preset={preset} onChange={(r, p) => { setRange(r); setPreset(p) }} />
          </div>
        }
      />

      <KpiTiles current={kpis} previous={prevKpis} loading={current.loading} />

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Filtered to {selected.size} account{selected.size > 1 ? 's' : ''}:</span>
          {selectedNames.slice(0, 4).map((n) => (
            <span key={n} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">{n}</span>
          ))}
          {selectedNames.length > 4 && <span className="text-xs text-muted">+{selectedNames.length - 4} more</span>}
          <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand">
            <X size={12} /> Clear
          </button>
        </div>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2 pt-2">
          <div className="-mb-px flex overflow-x-auto">
            {TABS.map((t) => {
              const n = filtered && t.key !== 'working' ? (t.key === 'leads' ? filtered.leads.length : filtered[t.key].length) : null
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {t.label} {n !== null && <span className="tabular text-xs opacity-70">[{n}]</span>}
                </button>
              )
            })}
          </div>
          <div className="flex w-full items-center gap-2 pb-2 sm:w-auto">
            <label className="flex h-8 flex-1 items-center gap-1.5 rounded-lg border border-line px-2 sm:w-56 sm:flex-none">
              <Search size={14} className="text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full bg-transparent text-sm outline-none" />
            </label>
            <button onClick={exportCsv} className="flex h-8 items-center gap-1 rounded-lg border border-line px-2 text-sm font-medium" title="Download CSV">
              <Download size={14} /> <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {current.error && <p className="p-4 text-sm text-bad">Couldn't load data: {current.error.message}</p>}
        {current.loading && !current.data && <p className="p-6 text-center text-sm text-muted">Loading…</p>}
        {filtered && tab === 'leads' && <LeadsList leads={filtered.leads} />}
        {tab === 'working' && <WhatsWorking range={range} />}
        {filtered && tab !== 'leads' && tab !== 'working' && (
          <>
            <div className="hidden md:block">
              <EntityTable level={tab} rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onOpenCreative={setCreativeRow} />
            </div>
            <div className="md:hidden">
              <EntityCards level={tab} rows={rows} selected={selected} onToggle={toggle} onOpenCreative={setCreativeRow} />
            </div>
          </>
        )}
      </Card>

      <CreativeModal row={creativeRow} onClose={() => setCreativeRow(null)} />
    </div>
  )
}

function minutesAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  return `${h} hour${h > 1 ? 's' : ''} ago`
}
