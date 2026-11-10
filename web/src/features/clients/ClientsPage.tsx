/**
 * Clients (docs/sop/new-client-or-ad-account.md#changing-a-client-in-the-lab).
 * Everyone sees every client: status, ads manager, ad accounts.
 * Owners and admins can change status (New / Active / Paused / Inactive), the
 * ads manager, and which ad accounts belong to the client. Those changes are
 * stored in The Lab and win over GHL and Retool (set_client_control,
 * migrations 2400 and 2500); "Use GHL and Retool again" undoes them.
 * Only Active and New clients appear in Insights, Suggestions and Ad approval.
 */
import { useMemo, useState } from 'react'
import { Link2, Search, X } from 'lucide-react'
import { Card, Empty, Modal, PageTitle } from '../../components/ui'
import { useData, type ClientRow } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useSession } from '../../app/session'

const STATUSES = ['Active', 'New', 'Paused', 'Inactive'] as const
type View = 'live' | 'Paused' | 'Inactive' | 'changed' | 'all'
const VIEWS: { key: View; label: string }[] = [
  { key: 'live', label: 'Active and New' },
  { key: 'Paused', label: 'Paused' },
  { key: 'Inactive', label: 'Inactive' },
  { key: 'changed', label: 'Changed in The Lab' },
  { key: 'all', label: 'All' },
]

const STATUS_STYLE: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800',
  New: 'bg-sky-100 text-sky-900',
  Paused: 'bg-amber-100 text-amber-900',
  Inactive: 'bg-subtle text-muted',
}

function StatusTag({ status }: { status: string | null }) {
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status ?? ''] ?? 'bg-subtle text-muted'}`}>
      {status ?? 'No status'}
    </span>
  )
}

export function ClientsPage() {
  const ds = useData()
  const { isAdmin } = useSession()
  const [version, setVersion] = useState(0)
  const list = useAsync(() => ds.clients(), [ds, version])
  const [view, setView] = useState<View>('live')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list.data ?? []).filter((c) => {
      if (view === 'live' && c.status !== 'Active' && c.status !== 'New') return false
      if ((view === 'Paused' || view === 'Inactive') && c.status !== view) return false
      if (view === 'changed' && !c.overridden && !c.accounts.some((a) => a.linkedInLab)) return false
      return !q || [c.name, c.managerName, c.city, ...c.accounts.map((a) => a.name)].some((v) => v?.toLowerCase().includes(q))
    })
  }, [list.data, view, query])

  const count = (v: View) => (list.data ?? []).filter((c) =>
    v === 'all' ? true : v === 'live' ? c.status === 'Active' || c.status === 'New'
      : v === 'changed' ? c.overridden || c.accounts.some((a) => a.linkedInLab) : c.status === v).length

  return (
    <div>
      <PageTitle
        title="Clients"
        subtitle={isAdmin
          ? 'Status and ads manager come from GHL and Retool. Click a client to change them here; Lab changes win.'
          : 'Status and ads manager come from GHL and Retool. Owners and admins can change them here.'}
      />
      {notice && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Close"><X size={14} /></button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-x-auto rounded-lg border border-line bg-surface p-0.5">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${view === v.key ? 'bg-subtle text-ink' : 'text-muted'}`}>
              {v.label} <span className="tabular text-xs opacity-70">{count(v.key)}</span>
            </button>
          ))}
        </div>
        <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 sm:max-w-xs">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients, managers, ad accounts" className="w-full bg-transparent text-sm outline-none" />
        </label>
      </div>

      {list.error && <p className="text-sm text-bad">Couldn't load clients: {list.error.message}</p>}
      {list.loading && !list.data && <p className="py-8 text-center text-sm text-muted">Loading...</p>}
      <Card className="divide-y divide-line">
        {list.data && rows.length === 0 && <Empty>No clients here.</Empty>}
        {rows.map((c) => (
          <button key={c.id} type="button" disabled={!isAdmin} onClick={() => setEditing(c)}
            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left enabled:hover:bg-subtle">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted">
                {[c.city, c.accounts.length ? c.accounts.map((a) => a.name ?? a.id).join(', ') : 'No ad account linked'].filter(Boolean).join(' · ')}
              </div>
            </div>
            {(c.overridden || c.accounts.some((a) => a.linkedInLab)) && (
              <span className="text-[11px] font-medium text-brand" title={c.note ?? undefined}>Changed in The Lab</span>
            )}
            <span className="w-28 truncate text-right text-xs text-soft">{c.managerName ?? 'No ads manager'}</span>
            <StatusTag status={c.status} />
          </button>
        ))}
      </Card>

      {editing && (
        <EditClient c={editing} onClose={() => setEditing(null)}
          onDone={(text) => { setEditing(null); setNotice(text); setVersion((v) => v + 1) }} />
      )}
    </div>
  )
}

function EditClient({ c, onClose, onDone }: { c: ClientRow; onClose: () => void; onDone: (text: string) => void }) {
  const ds = useData()
  const staff = useAsync(() => ds.staff(), [ds])
  const unlinked = useAsync(() => ds.unlinkedAccounts(), [ds])
  const [status, setStatus] = useState(c.status ?? '')
  const [manager, setManager] = useState(c.managerId ?? '')
  const [link, setLink] = useState('')
  const [unlink, setUnlink] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const managers = (staff.data ?? []).filter((s) => s.active && (s.isAdManager || s.id === c.managerId))
  const changed = status !== (c.status ?? '') || manager !== (c.managerId ?? '') || !!link || unlink.length > 0

  const run = async (fn: () => Promise<void>, text: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone(text)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const save = () => run(() => ds.setClient(c.id, {
    status: status !== (c.status ?? '') ? status : undefined,
    managerId: manager !== (c.managerId ?? '') ? manager : undefined,
    link: link ? [link] : undefined,
    unlink: unlink.length ? unlink : undefined,
    note: note.trim() || undefined,
  }), `${c.name} updated.${status === 'Inactive' || status === 'Paused' ? ' It no longer shows in Insights, Suggestions or Ad approval.' : ''}`)

  const field = 'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm'
  return (
    <Modal open onClose={onClose} title={c.name}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={field}>
            {!c.status && <option value="">No status</option>}
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted">Inactive = removed from The Lab. Paused = hidden until set back to Active.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Ads manager</span>
          <select value={manager} onChange={(e) => setManager(e.target.value)} className={field}>
            {!c.managerId && <option value="">No ads manager</option>}
            {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold text-soft">Ad accounts</span>
          <ul className="space-y-1">
            {c.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className={unlink.includes(a.id) ? 'text-muted line-through' : ''}>
                  {a.name ?? a.id} <span className="text-xs text-muted">{a.id}{a.linkedInLab ? ' · linked in The Lab' : ''}</span>
                </span>
                <button type="button" className="text-xs font-medium text-muted hover:text-bad"
                  onClick={() => setUnlink((u) => (u.includes(a.id) ? u.filter((x) => x !== a.id) : [...u, a.id]))}>
                  {unlink.includes(a.id) ? 'Keep' : 'Unlink'}
                </button>
              </li>
            ))}
            {c.accounts.length === 0 && <li className="text-muted">None linked.</li>}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <Link2 size={14} className="shrink-0 text-muted" />
            <select value={link} onChange={(e) => setLink(e.target.value)} className={field}>
              <option value="">{unlinked.data ? `Link an ad account (${unlinked.data.length} not linked)` : 'Loading...'}</option>
              {unlinked.data?.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.id} ({a.id})</option>)}
            </select>
          </div>
          <span className="mt-1 block text-xs text-muted">Only ad accounts shared with The Lab's Meta connection are listed.</span>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why, e.g. client cancelled" className={field} />
        </label>
        {(c.overridden || c.accounts.some((a) => a.linkedInLab)) && (
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-soft">
            Changed in The Lab{c.overrideBy ? ` by ${c.overrideBy}` : ''}{c.note ? `: ${c.note}` : ''}. GHL and Retool may say something different.
          </p>
        )}
        {error && <p className="text-bad">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {(c.overridden || c.accounts.some((a) => a.linkedInLab)) ? (
            <button type="button" disabled={busy} className="text-xs font-medium text-muted hover:text-ink"
              onClick={() => run(() => ds.setClient(c.id, { clear: true }), `${c.name}: Lab changes removed. GHL and Retool decide again within 15 minutes.`)}>
              Use GHL and Retool again
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted">Cancel</button>
            <button type="button" onClick={save} disabled={busy || !changed}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-40">
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
