/**
 * Ad approval list (replaces Retool's Ad Preview list). docs/sop/ad-approval-submit.md
 *  - "Needs me": ads waiting for my review, and my ads that need changes.
 *  - Grouped by status, most urgent first. Retool history hidden unless asked for.
 *  - "New ad" picks a client and a name, then opens the editor.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ImageIcon, Plus, Search } from 'lucide-react'
import { STATUS_LABEL, STATUS_ORDER, type ReviewStatus } from '@shared/domain/approvals.ts'
import { Card, Empty, Modal, PageTitle } from '../../components/ui'
import { useData } from '../../data/source'
import type { ReviewSummary } from '../../data/approvals'
import { useAsync } from '../../lib/useAsync'
import { useSession } from '../../app/session'
import { Button, Field, StatusPill, ago, inputClass } from './parts'

type View = 'mine' | 'open' | 'all' | 'history'

const VIEWS: { key: View; label: string }[] = [
  { key: 'mine', label: 'Needs me' },
  { key: 'open', label: 'In progress' },
  { key: 'all', label: 'All' },
  { key: 'history', label: 'From Retool' },
]

export function ApprovalsPage() {
  const ds = useData()
  const { me } = useSession()
  const list = useAsync(() => ds.approvals.list(), [ds])
  const [view, setView] = useState<View>('mine')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    const all = list.data ?? []
    const q = query.trim().toLowerCase()
    return all.filter((r) => {
      if (view === 'history' ? !r.legacy : r.legacy) return false
      if (view === 'mine') {
        const mineToReview = r.status === 'review_pending' && r.reviewerId === me?.id
        const myChanges = r.createdBy === me?.id && ['draft', 'request_changes', 'approved'].includes(r.status)
        if (!mineToReview && !myChanges) return false
      }
      if (view === 'open' && r.status === 'completed') return false
      return !q || [r.name, r.clientName, r.createdByName, r.reviewerName].some((v) => v?.toLowerCase().includes(q))
    })
  }, [list.data, view, query, me?.id])

  const groups = STATUS_ORDER.map((s) => ({ status: s, rows: rows.filter((r) => r.status === s) })).filter((g) => g.rows.length)
  const counts = useMemo(() => {
    const all = (list.data ?? []).filter((r) => !r.legacy)
    return {
      mine: all.filter((r) => (r.status === 'review_pending' && r.reviewerId === me?.id) || (r.createdBy === me?.id && ['draft', 'request_changes', 'approved'].includes(r.status))).length,
      open: all.filter((r) => r.status !== 'completed').length,
      all: all.length,
      history: (list.data ?? []).length - all.length,
    }
  }, [list.data, me?.id])

  return (
    <div>
      <PageTitle
        title="Ad approval"
        subtitle="Submit ads for review. A mistake check reads the copy, image text and video subtitles first."
        right={<Button kind="primary" onClick={() => setCreating(true)}><Plus size={16} /> New ad</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-x-auto rounded-lg border border-line bg-surface p-0.5">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${view === v.key ? 'bg-subtle text-ink' : 'text-muted'}`}>
              {v.label} <span className="tabular text-xs opacity-70">{counts[v.key]}</span>
            </button>
          ))}
        </div>
        <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 sm:max-w-xs">
          <Search size={14} className="text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ads or clients" className="w-full bg-transparent text-sm outline-none" />
        </label>
      </div>

      {list.error && <p className="text-sm text-bad">Couldn't load ads: {list.error.message}</p>}
      {list.loading && !list.data && <p className="py-8 text-center text-sm text-muted">Loading...</p>}
      {list.data && groups.length === 0 && (
        <Card><Empty>{view === 'mine' ? 'Nothing needs you right now.' : 'No ads here.'}</Empty></Card>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.status}>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{STATUS_LABEL[g.status as ReviewStatus]} ({g.rows.length})</h2>
            <Card className="divide-y divide-line">
              {g.rows.slice(0, 200).map((r) => <Row key={r.id} r={r} />)}
              {g.rows.length > 200 && <p className="px-3 py-2 text-xs text-muted">Showing 200 of {g.rows.length}. Search to narrow it down.</p>}
            </Card>
          </div>
        ))}
      </div>

      <NewAdModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function Row({ r }: { r: ReviewSummary }) {
  return (
    <Link to={`/approvals/${r.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-subtle">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-subtle">
        {r.thumbUrl ? <img src={r.thumbUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} className="text-muted" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{r.name}</div>
        <div className="truncate text-xs text-muted">
          {r.clientName ?? 'No client'}
          {r.createdByName && ` · by ${r.createdByName}`}
          {r.reviewerName && r.status === 'review_pending' && ` · reviewer ${r.reviewerName}`}
        </div>
      </div>
      {r.openFindings > 0 && (
        <span className="hidden items-center gap-1 text-xs font-medium text-amber-800 sm:flex" title="Possible mistakes still open">
          <AlertTriangle size={13} /> {r.openFindings}
        </span>
      )}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <StatusPill status={r.status} />
        <span className="text-[11px] text-muted">{ago(r.updatedAt)}</span>
      </div>
    </Link>
  )
}

function NewAdModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ds = useData()
  const navigate = useNavigate()
  const { me } = useSession()
  const clients = useAsync(() => (open ? ds.approvals.clients() : Promise.resolve([])), [ds, open])
  const [filter, setFilter] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const all = clients.data ?? []
    // My clients first.
    return [...all].sort((a, b) => Number(b.managerId === me?.id) - Number(a.managerId === me?.id) || a.name.localeCompare(b.name))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [clients.data, filter, me?.id])

  const create = async () => {
    if (!clientId || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const id = await ds.approvals.create({ clientId, name })
      onClose()
      navigate(`/approvals/${id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New ad">
      <div className="space-y-3">
        <Field label="Client">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type to search clients" className={inputClass} />
          <div className="mt-1 max-h-52 overflow-auto rounded-lg border border-line">
            {options.map((c) => (
              <button key={c.id} type="button" onClick={() => setClientId(c.id)}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm ${clientId === c.id ? 'bg-subtle font-semibold' : 'hover:bg-subtle'}`}>
                <span className="truncate">{c.name}</span>
                {c.managerId === me?.id && <span className="text-xs text-muted">yours</span>}
              </button>
            ))}
            {clients.data && options.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">No Active or New client matches.</p>}
          </div>
        </Field>
        <Field label="Ad name" hint="Use the campaign naming convention.">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} onKeyDown={(e) => e.key === 'Enter' && create()} />
        </Field>
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button kind="quiet" onClick={onClose}>Cancel</Button>
          <Button kind="primary" onClick={create} disabled={busy || !clientId || !name.trim()}>{busy ? 'Creating...' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  )
}
