/**
 * Prospects (docs/prospects.md, docs/sop/prospects.md). OWNERS ONLY.
 *
 * People MRKD is selling to: chats come from GHL every 30 minutes, Jev
 * suggests the type of business and how warm it is, and the owners set the
 * value (dollars a month), stage, next step and notes. Anything Jev suggested
 * can be changed; the owner's choice wins.
 *
 * Deliberately not a table like Insights: a pipeline panel on top, then a
 * board by stage (desktop) or stage tabs with cards (phone).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, CheckSquare, ExternalLink, EyeOff, Flame, Lock, Plus, Search, Snowflake, Sun, X } from 'lucide-react'
import { MRKD_LOCATION_ID } from '@shared/domain/ghl.ts'
import {
  INDUSTRIES, OPEN_STAGES, STAGES, TEMPERATURES, industryOf, label, lastContact, money, onBoard, pipelineTotals,
  stageOf, temperatureOf, type ChatMessage, type Industry, type ProspectRow, type Stage, type Temperature,
} from '@shared/domain/prospects.ts'
import { Empty, Modal } from '../../components/ui'
import { useData } from '../../data/source'
import type { GhlContactResult, ProspectChange } from '../../data/prospects'
import { useAsync } from '../../lib/useAsync'
import { useSession } from '../../app/session'

const TEMP_STYLE: Record<Temperature, { bar: string; chip: string; icon: typeof Flame }> = {
  hot: { bar: 'bg-[var(--color-hot)]', chip: 'bg-[var(--color-hot-soft)] text-[var(--color-hot)]', icon: Flame },
  warm: { bar: 'bg-[var(--color-warm)]', chip: 'bg-[var(--color-warm-soft)] text-[var(--color-warm)]', icon: Sun },
  cold: { bar: 'bg-[var(--color-cold)]', chip: 'bg-[var(--color-cold-soft)] text-[var(--color-cold)]', icon: Snowflake },
}
const TEMP_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 }

const ghlLink = (contactId: string) => `https://app.gohighlevel.com/v2/location/${MRKD_LOCATION_ID}/contacts/detail/${contactId}`
const shortDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)

type IndustryFilter = Industry | 'all'

/** What a card can do: open, remove from the board, or be picked in Select mode. */
interface CardActions {
  remove: (rows: ProspectRow[]) => void
  selecting: boolean
  selected: Set<string>
  toggle: (id: string) => void
}
const CardCtx = createContext<CardActions>({ remove: () => {}, selecting: false, selected: new Set(), toggle: () => {} })

interface Toast { text: string; undo?: () => Promise<void> }

export function ProspectsPage() {
  const { me } = useSession()
  if (me && me.role !== 'owner') {
    return <Empty>Prospects is only for the owners.</Empty>
  }
  return <Prospects />
}

function Prospects() {
  const ds = useData()
  const [version, setVersion] = useState(0)
  const list = useAsync(() => ds.prospects.list(), [ds, version])
  const [industry, setIndustry] = useState<IndustryFilter>('all')
  const [temps, setTemps] = useState<Temperature[]>([])
  const [query, setQuery] = useState('')
  const [phoneStage, setPhoneStage] = useState<Stage | 'open'>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showOff, setShowOff] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<Toast | null>(null)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(t)
  }, [toast])

  const setHidden = async (rows: ProspectRow[], hidden: boolean) => {
    for (const r of rows) await ds.prospects.save(r.contactId, hidden ? { hidden: true } : { hidden: false, stage: r.stage ?? 'new' })
    reload()
  }
  /** Remove from the board ("Not a prospect"), with Undo. */
  const remove = async (rows: ProspectRow[]) => {
    if (!rows.length) return
    try {
      await setHidden(rows, true)
      setSelected(new Set()); setSelecting(false)
      setToast({ text: rows.length === 1 ? `Removed ${rows[0].name}` : `Removed ${rows.length} people`, undo: () => setHidden(rows, false) })
    } catch (e) {
      setToast({ text: `Couldn't remove: ${(e as Error).message}` })
    }
  }
  const actions: CardActions = {
    remove: (rows) => { void remove(rows) },
    selecting,
    selected,
    toggle: (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }),
  }

  const all = list.data ?? []
  const board = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter(onBoard)
      .filter((p) => industry === 'all' || industryOf(p) === industry)
      .filter((p) => !temps.length || temps.includes(temperatureOf(p) as Temperature))
      .filter((p) => !q || [p.name, p.company, p.notes, p.nextStep].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (TEMP_ORDER[temperatureOf(a) ?? ''] ?? 3) - (TEMP_ORDER[temperatureOf(b) ?? ''] ?? 3)
        || (b.lastMessageAt ?? b.updatedAt ?? '').localeCompare(a.lastMessageAt ?? a.updatedAt ?? ''))
  }, [all, industry, temps, query])
  const offBoard = all.filter((p) => !onBoard(p))
  const totals = pipelineTotals(board)
  const open = all.find((p) => p.contactId === openId) ?? null

  return (
    <div className={selecting || toast ? 'pb-20' : ''}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Prospects</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Lock size={13} /> Only Jordan and Trent can see this</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          <Plus size={16} /> Add
        </button>
      </div>

      <PipelinePanel totals={totals} temps={temps} onTemps={setTemps} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex max-w-full overflow-x-auto rounded-full bg-subtle p-1 text-sm">
          {([{ key: 'all', label: 'All' }, ...INDUSTRIES] as { key: IndustryFilter; label: string }[]).map((o) => (
            <button key={o.key} onClick={() => setIndustry(o.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 font-medium ${industry === o.key ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm sm:w-72">
          <Search size={15} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company, notes" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <button onClick={() => { setSelecting((s) => !s); setSelected(new Set()) }}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${selecting ? 'bg-ink text-canvas ring-ink' : 'bg-surface text-soft ring-line'}`}>
          <CheckSquare size={15} /> {selecting ? 'Done selecting' : 'Select'}
        </button>
      </div>
      {selecting && <p className="-mt-2 mb-3 text-sm text-muted">Tap people to pick them, then remove them from the board together.</p>}

      {list.loading && !list.data ? <Empty>Loading prospects…</Empty>
        : list.error ? <Empty>Couldn't load prospects: {list.error.message}</Empty>
        : (
          <CardCtx.Provider value={actions}>
            <Board rows={board} onOpen={setOpenId} />
            <PhoneList rows={board} stage={phoneStage} onStage={setPhoneStage} onOpen={setOpenId} />
          </CardCtx.Provider>
        )}

      {offBoard.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowOff((s) => !s)} className="text-sm font-medium text-brand">
            {showOff ? 'Hide' : 'Show'} not on the board ({offBoard.length})
          </button>
          {showOff && (
            <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
              <p className="px-4 py-2 text-xs text-muted">Clients, job applicants, vendors, calls with nothing to read, and anyone you removed. Tap a name to see the chat, or <b>Add to board</b>.</p>
              {offBoard.map((p) => (
                <div key={p.contactId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <button onClick={() => setOpenId(p.contactId)} className="min-w-0 flex-1 truncate text-left hover:underline">
                    <span className="font-medium">{p.name}</span>{p.company && <span className="text-muted"> · {p.company}</span>}
                    <span className="ml-2 text-xs text-muted">{p.hidden ? 'Removed' : kindLabel(p.aiKind)}</span>
                  </button>
                  <button onClick={async () => { await setHidden([p], false); setToast({ text: `${p.name} is on the board` }) }}
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-brand ring-1 ring-line hover:bg-hover">Add to board</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selecting && (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl md:bottom-6">
          <span className="flex-1 text-sm font-medium">{selected.size} selected</span>
          <button disabled={!selected.size} onClick={() => remove(all.filter((p) => selected.has(p.contactId)))}
            className="rounded-full bg-canvas px-4 py-1.5 text-sm font-semibold text-ink disabled:opacity-40">Remove from board</button>
          <button onClick={() => { setSelecting(false); setSelected(new Set()) }} className="text-sm opacity-70">Cancel</button>
        </div>
      )}
      {toast && !selecting && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-xl md:bottom-6">
          <span className="flex-1">{toast.text}</span>
          {toast.undo && <button onClick={async () => { const u = toast.undo!; setToast(null); await u() }} className="font-semibold underline">Undo</button>}
          <button onClick={() => setToast(null)} aria-label="Close" className="opacity-60"><X size={16} /></button>
        </div>
      )}

      {open && <ProspectSheet key={open.contactId} p={open} onClose={() => setOpenId(null)} onSaved={reload}
        onRemove={() => { setOpenId(null); void remove([open]) }} />}
      <AddProspect open={adding} onClose={() => setAdding(false)} onAdded={(name) => { reload(); setToast({ text: `${name} is on the board` }) }} />
    </div>
  )
}

const kindLabel = (k: ProspectRow['aiKind']) =>
  ({ client: 'Looks like a client', candidate: 'Job applicant', consumer: 'Member of the public', other: 'Vendor or other', prospect: 'Prospect' } as Record<string, string>)[k ?? ''] ?? 'Nothing to read yet'

function PipelinePanel({ totals, temps, onTemps }: { totals: ReturnType<typeof pipelineTotals>; temps: Temperature[]; onTemps: (t: Temperature[]) => void }) {
  const toggle = (t: Temperature) => onTemps(temps.includes(t) ? temps.filter((x) => x !== t) : [...temps, t])
  return (
    <div className="mb-4 rounded-3xl bg-[var(--color-pipeline)] p-4 text-[var(--color-pipeline-ink)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Open pipeline</div>
          <div className="kpi-value tabular text-3xl font-bold sm:text-4xl">{money(totals.openValue)}<span className="text-base font-medium opacity-60"> / month</span></div>
          <div className="text-sm opacity-70">{totals.open} open{totals.won.count ? ` · won ${money(totals.won.value)} / month (${totals.won.count})` : ''}</div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
          {TEMPERATURES.map((t) => {
            const b = totals.byTemperature[t.key]
            const Icon = TEMP_STYLE[t.key].icon
            const on = temps.includes(t.key)
            return (
              <button key={t.key} onClick={() => toggle(t.key)} title={on ? 'Show all' : `Show ${t.label.toLowerCase()} only`}
                className={`rounded-2xl px-3 py-2 text-left transition ${on ? 'bg-white/20 ring-2 ring-white/60' : 'bg-white/[0.07] hover:bg-white/[0.12]'}`}>
                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: `var(--color-${t.key})` }}><Icon size={13} /> {t.label}</div>
                <div className="tabular text-lg font-bold">{money(b.value)}</div>
                <div className="text-[11px] opacity-60">{b.count} {b.count === 1 ? 'person' : 'people'}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Desktop: one column per open stage; Won and Lost underneath. */
function Board({ rows, onOpen }: { rows: ProspectRow[]; onOpen: (id: string) => void }) {
  const [closedOpen, setClosedOpen] = useState<Stage | null>(null)
  return (
    <div className="hidden lg:block">
      <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.filter((s) => OPEN_STAGES.includes(s.key)).map((s) => {
        const items = rows.filter((p) => stageOf(p) === s.key)
        const value = items.reduce((n, p) => n + (p.value ?? 0), 0)
        return (
          <section key={s.key} className="flex min-w-[14rem] flex-1 flex-col rounded-2xl bg-subtle/70 p-2">
            <header className="flex items-baseline justify-between px-2 pb-2 pt-1">
              <h2 className="text-sm font-bold">{s.label} <span className="font-medium text-muted">{items.length}</span></h2>
              {value > 0 && <span className="tabular text-xs font-semibold text-soft">{money(value)}</span>}
            </header>
            <div className="flex flex-col gap-2">
              {items.map((p) => <ProspectCard key={p.contactId} p={p} onOpen={onOpen} />)}
              {!items.length && <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Nobody here</div>}
            </div>
          </section>
        )
      })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['won', 'lost'] as Stage[]).map((k) => {
          const items = rows.filter((p) => stageOf(p) === k)
          const value = items.reduce((n, p) => n + (p.value ?? 0), 0)
          return (
            <button key={k} onClick={() => setClosedOpen(closedOpen === k ? null : k)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${closedOpen === k ? 'bg-ink text-canvas ring-ink' : 'bg-surface text-soft ring-line'}`}>
              {label(STAGES, k)} {items.length}{value ? ` · ${money(value)} / month` : ''}
            </button>
          )
        })}
      </div>
      {closedOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {rows.filter((p) => stageOf(p) === closedOpen).map((p) => <ProspectCard key={p.contactId} p={p} onOpen={onOpen} compact />)}
          {!rows.some((p) => stageOf(p) === closedOpen) && <p className="text-sm text-muted">Nobody here yet.</p>}
        </div>
      )}
    </div>
  )
}

/** Phone: stage tabs, then cards. */
function PhoneList({ rows, stage, onStage, onOpen }: { rows: ProspectRow[]; stage: Stage | 'open'; onStage: (s: Stage | 'open') => void; onOpen: (id: string) => void }) {
  const tabs: { key: Stage | 'open'; label: string; n: number }[] = [
    { key: 'open', label: 'All open', n: rows.filter((p) => OPEN_STAGES.includes(stageOf(p))).length },
    ...STAGES.map((s) => ({ key: s.key as Stage, label: s.label, n: rows.filter((p) => stageOf(p) === s.key).length })),
  ]
  const shown = rows.filter((p) => (stage === 'open' ? OPEN_STAGES.includes(stageOf(p)) : stageOf(p) === stage))
  return (
    <div className="lg:hidden">
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => onStage(t.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${stage === t.key ? 'bg-ink text-canvas' : 'bg-surface text-soft ring-1 ring-line'}`}>
            {t.label} <span className="opacity-60">{t.n}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((p) => <ProspectCard key={p.contactId} p={p} onOpen={onOpen} showStage={stage === 'open'} />)}
        {!shown.length && <Empty>Nobody in this stage.</Empty>}
      </div>
    </div>
  )
}

function TempChip({ t, suggested }: { t: Temperature | null; suggested?: boolean }) {
  if (!t) return <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">Not read</span>
  const Icon = TEMP_STYLE[t].icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${TEMP_STYLE[t].chip}`} title={suggested ? 'Suggested by Jev from the chat' : 'Set by an owner'}>
      <Icon size={11} /> {label(TEMPERATURES, t)}{suggested ? '*' : ''}
    </span>
  )
}

function ProspectCard({ p, onOpen, compact, showStage }: { p: ProspectRow; onOpen: (id: string) => void; compact?: boolean; showStage?: boolean }) {
  const ctx = useContext(CardCtx)
  const t = temperatureOf(p)
  const ind = industryOf(p)
  const overdue = p.nextDate && p.nextDate < today()
  const picked = ctx.selected.has(p.contactId)
  const click = () => (ctx.selecting ? ctx.toggle(p.contactId) : onOpen(p.contactId))
  return (
    <div role="button" tabIndex={0} aria-label={p.company ? `${p.name}, ${p.company}` : p.name} aria-pressed={ctx.selecting ? picked : undefined} onClick={click}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click() } }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl bg-surface p-3 pl-4 text-left shadow-sm ring-1 transition hover:ring-[var(--color-brand)] ${picked ? 'ring-2 ring-[var(--color-brand)]' : 'ring-line'}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${t ? TEMP_STYLE[t].bar : 'bg-line'}`} />
      {ctx.selecting ? (
        <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full ring-1 ${picked ? 'bg-brand text-on-primary ring-brand' : 'bg-surface ring-line'}`}>
          {picked && <Check size={13} />}
        </span>
      ) : (
        <button type="button" title="Not a prospect: remove from the board" aria-label={`Remove ${p.name} from the board`}
          onClick={(e) => { e.stopPropagation(); ctx.remove([p]) }}
          className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted opacity-60 hover:bg-subtle hover:text-ink hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100">
          <X size={14} />
        </button>
      )}
      <div className="flex items-start justify-between gap-2 pr-5">
        <div className="min-w-0">
          <div className="truncate font-semibold">{p.name}</div>
          {p.company && <div className="truncate text-xs text-muted">{p.company}</div>}
        </div>
        {p.value != null && <div className="tabular shrink-0 text-right text-sm font-bold">{money(p.value)}<span className="block text-[10px] font-medium text-muted">/ month</span></div>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TempChip t={t} suggested={!p.temperature && !!p.aiTemperature} />
        {ind && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-soft">{label(INDUSTRIES, ind)}</span>}
        {showStage && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-soft ring-1 ring-line">{label(STAGES, stageOf(p))}</span>}
        {p.channel && <span className="text-[11px] text-muted">{p.channel}</span>}
      </div>
      {!compact && (
        <>
          {lastContact(p) && <div className="mt-2 text-xs text-soft">{lastContact(p)}</div>}
          {clean(p.lastPreview) && <div className="mt-0.5 line-clamp-2 text-xs italic text-muted">"{clean(p.lastPreview)}"</div>}
          {p.nextStep && (
            <div className={`mt-2 rounded-lg px-2 py-1 text-xs font-medium ${overdue ? 'bg-[var(--color-hot-soft)] text-[var(--color-hot)]' : 'bg-subtle text-soft'}`}>
              Next: {p.nextStep}{p.nextDate ? ` · ${shortDate(p.nextDate)}` : ''}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Choice<T extends string>({ options, value, suggested, by = 'Jev', onChange }: {
  options: readonly { key: T; label: string }[]; value: T | null; suggested?: T | null; by?: string; onChange: (v: T | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = (value ?? suggested) === o.key
        return (
          <button key={o.key} type="button" onClick={() => onChange(value === o.key ? null : o.key)}
            className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${on ? 'bg-ink text-canvas ring-ink' : 'bg-surface text-soft ring-line hover:bg-hover'} ${on && !value ? 'opacity-70' : ''}`}>
            {o.label}{on && !value ? ` (${by})` : ''}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label: text, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{text}</span>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ProspectSheet({ p, onClose, onSaved, onRemove }: { p: ProspectRow; onClose: () => void; onSaved: () => void; onRemove: () => void }) {
  const ds = useData()
  const chat = useAsync(() => ds.prospects.messages(p.contactId), [ds, p.contactId])
  const [industry, setIndustry] = useState<Industry | null>(p.industry)
  const [temperature, setTemperature] = useState<Temperature | null>(p.temperature)
  const [stage, setStage] = useState<Stage | null>(p.stage)
  const [value, setValue] = useState(p.value != null ? String(p.value) : '')
  const [nextStep, setNextStep] = useState(p.nextStep ?? '')
  const [nextDate, setNextDate] = useState(p.nextDate ?? '')
  const [notes, setNotes] = useState(p.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const run = async (change: ProspectChange, close = false) => {
    setBusy(true); setError(null); setSaved(false)
    try {
      await ds.prospects.save(p.contactId, change)
      onSaved()
      if (close) onClose(); else setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const save = () => {
    const v = value.trim() === '' ? null : Number(value.replace(/[$,\s]/g, ''))
    if (v != null && (!Number.isFinite(v) || v < 0)) { setError('Value must be a dollar amount.'); return }
    // Saving puts it on the board (a stage is set) unless it's marked "Not a prospect".
    run({ industry, temperature, value: v, stage: stage ?? stageOf(p), nextStep, nextDate: nextDate || null, notes })
  }
  const remove = async () => {
    if (!confirm(`Delete ${p.name}? This only removes the one you added by hand.`)) return
    setBusy(true)
    try { await ds.prospects.remove(p.contactId); onSaved(); onClose() } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-label={p.name} onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col bg-canvas shadow-2xl sm:max-w-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{p.name}</h2>
            <div className="truncate text-sm text-muted">{[p.company, p.channel, lastContact(p)].filter(Boolean).join(' · ')}</div>
            {p.source === 'ghl' && (
              <a href={ghlLink(p.contactId)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
                Open in GHL <ExternalLink size={12} />
              </a>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-subtle" aria-label="Close"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-5 py-4">
            <Field label="Temperature" hint={p.aiTemperature ? `Jev read the chat: ${label(TEMPERATURES, p.aiTemperature)}` : undefined}>
              <Choice options={TEMPERATURES} value={temperature} suggested={p.aiTemperature} onChange={setTemperature} />
            </Field>
            <Field label="Type" hint={p.aiIndustry ? `Jev: ${label(INDUSTRIES, p.aiIndustry)}` : undefined}>
              <Choice options={INDUSTRIES} value={industry} suggested={p.aiIndustry} onChange={setIndustry} />
            </Field>
            <Field label="Stage" hint={p.ghlStage ? `In GHL: ${p.ghlStage}` : undefined}>
              <Choice options={STAGES} value={stage} suggested={stageOf({ stage: null, ghlStage: p.ghlStage })} by={p.ghlStage ? 'GHL' : 'start'} onChange={setStage} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Value ($ / month)" hint={p.ghlValue ? `In GHL: ${money(p.ghlValue)}` : undefined}>
                <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 1500"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
              </Field>
              <Field label="Next step date">
                <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
              </Field>
            </div>
            <Field label="Next step">
              <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} maxLength={300} placeholder="e.g. Follow up Dec 1 about moving over"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
            </Field>
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={5000}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy} onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
              {saved && <span className="text-sm text-good">Saved</span>}
              <span className="flex-1" />
              {p.source === 'manual'
                ? <button disabled={busy} onClick={remove} className="text-sm font-medium text-bad">Delete</button>
                : p.hidden
                  ? <button disabled={busy} onClick={() => run({ hidden: false, stage: p.stage ?? 'new' }, true)} className="text-sm font-medium text-brand">Back on the board</button>
                  : <button disabled={busy} onClick={onRemove} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-soft ring-1 ring-line hover:bg-hover"><EyeOff size={14} /> Not a prospect: remove</button>}
            </div>
            {p.updatedBy && p.updatedAt && <p className="text-xs text-muted">Last changed by {p.updatedBy}, {shortDate(p.updatedAt)}</p>}
            {p.temperature == null && p.aiTemperature && <p className="text-xs text-muted">* Suggested by Jev from the chat. Pick one to set it yourself; Jev won't change your choice.</p>}
          </div>

          {p.source === 'ghl' && (
            <div className="border-t border-line px-5 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Chat (latest {p.messageCount}, from GHL)</h3>
              {chat.loading ? <p className="text-sm text-muted">Loading…</p>
                : chat.error ? <p className="text-sm text-bad">{chat.error.message}</p>
                : <Chat messages={chat.data ?? []} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** GHL puts email images first as "[https://...png]": not useful here. */
const clean = (s: string | null) => (s ?? '').replace(/\[https?:\/\/[^\]\s]+\]\s*/g, '').trim()

const QUIET: Record<string, string> = {
  TYPE_CALL: 'Call', TYPE_ACTIVITY_APPOINTMENT: 'Appointment', TYPE_ACTIVITY_OPPORTUNITY: 'Opportunity update', TYPE_ACTIVITY_CONTACT: 'Contact update',
}

function Chat({ messages }: { messages: (ChatMessage & { id: string })[] }) {
  if (!messages.length) return <p className="text-sm text-muted">No messages to show.</p>
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => {
        const body = clean(m.body)
        const activity = !body || (m.type ?? '').startsWith('TYPE_ACTIVITY')
        if (activity) {
          return <div key={m.id} className="text-center text-[11px] text-muted">{QUIET[m.type ?? ''] ?? 'Activity'}{body ? `: ${body.replace(/_/g, ' ').slice(0, 80)}` : ''} · {shortDate(m.at)}</div>
        }
        const mine = m.direction === 'outbound'
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-primary text-on-primary' : 'rounded-bl-sm bg-surface ring-1 ring-line'}`}>
              {body}
              <div className={`mt-1 text-[10px] ${mine ? 'text-on-primary/70' : 'text-muted'}`}>{mine ? 'MRKD' : 'Them'} · {shortDate(m.at)}{m.type === 'TYPE_EMAIL' ? ' · Email' : ''}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddProspect({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const [tab, setTab] = useState<'ghl' | 'manual'>('ghl')
  return (
    <Modal open={open} onClose={onClose} title="Add to the board">
      <div className="mb-4 flex rounded-full bg-subtle p-1 text-sm">
        {([['ghl', 'From GHL'], ['manual', 'Not in GHL']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-full px-3 py-1.5 font-medium ${tab === k ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {tab === 'ghl' ? <AddFromGhl onAdded={(n) => { onAdded(n); onClose() }} /> : <AddByHand onAdded={(n) => { onAdded(n); onClose() }} />}
    </Modal>
  )
}

const STATE_LABEL: Record<GhlContactResult['state'], string> = {
  on_board: 'On the board', removed: 'Removed earlier', client: 'Client in GHL', new: '',
}

function AddFromGhl({ onAdded }: { onAdded: (name: string) => void }) {
  const ds = useData()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GhlContactResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults(null); return }
    let live = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await ds.prospects.searchGhl(q)
        if (live) { setResults(r); setError(null) }
      } catch (e) {
        if (live) setError((e as Error).message)
      } finally {
        if (live) setSearching(false)
      }
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [query, ds])

  const add = async (r: GhlContactResult) => {
    setAdding(r.contactId); setError(null)
    try {
      const res = await ds.prospects.addFromGhl(r.contactId)
      onAdded(res.name || r.name)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted">Search anyone in MRKD's GHL. Adding them brings in their latest chat, and Jev reads it.</p>
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <Search size={15} className="text-muted" />
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, email or phone number" className="min-w-0 flex-1 bg-transparent outline-none" />
      </label>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
        {searching && !results && <p className="py-3 text-sm text-muted">Searching GHL…</p>}
        {results?.length === 0 && <p className="py-3 text-sm text-muted">Nobody in GHL matches. Use "Not in GHL" to add them by hand.</p>}
        {results?.map((r) => (
          <div key={r.contactId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.name}</div>
              <div className="truncate text-xs text-muted">{[r.company, r.email, r.phone].filter(Boolean).join(' · ') || ' '}</div>
              {STATE_LABEL[r.state] && <div className="text-[11px] font-semibold text-soft">{STATE_LABEL[r.state]}</div>}
            </div>
            {r.state === 'on_board'
              ? <span className="shrink-0 text-xs text-muted">Already added</span>
              : <button disabled={adding !== null} onClick={() => add(r)} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50">
                  {adding === r.contactId ? 'Adding…' : r.state === 'removed' ? 'Add back' : 'Add'}
                </button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AddByHand({ onAdded }: { onAdded: (name: string) => void }) {
  const ds = useData()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [channel, setChannel] = useState('Facebook')
  const [industry, setIndustry] = useState<Industry | null>(null)
  const [temperature, setTemperature] = useState<Temperature | null>(null)
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!name.trim()) { setError('Add a name.'); return }
    const v = value.trim() === '' ? null : Number(value.replace(/[$,\s]/g, ''))
    if (v != null && (!Number.isFinite(v) || v < 0)) { setError('Value must be a dollar amount.'); return }
    setBusy(true); setError(null)
    try {
      await ds.prospects.add({ name, company, channel, industry, temperature, value: v, stage: 'new', notes })
      onAdded(name.trim())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <p className="mb-3 text-sm text-muted">For someone who isn't in GHL, e.g. a chat on your personal Facebook.</p>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Business (optional)" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Where you're talking (Facebook, text...)" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <Field label="Type"><Choice options={INDUSTRIES} value={industry} onChange={setIndustry} /></Field>
        <Field label="Temperature"><Choice options={TEMPERATURES} value={temperature} onChange={setTemperature} /></Field>
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value, $ / month (optional)" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        {error && <p className="text-sm text-bad">{error}</p>}
        <button disabled={busy} onClick={submit} className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{busy ? 'Adding…' : 'Add'}</button>
      </div>
    </div>
  )
}
