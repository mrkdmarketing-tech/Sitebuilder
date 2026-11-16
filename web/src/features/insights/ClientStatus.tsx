/**
 * Change a client's status straight from Insights (owners and admins).
 * Same change as the Clients screen (set_client_control): stored in The Lab,
 * wins over GHL/Retool, reversible there. docs/sop/new-client-or-ad-account.md
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ReportRow } from '@shared/domain/types.ts'
import { ClientBadge, Modal } from '../../components/ui'
import { useData } from '../../data/source'

export const CLIENT_STATUSES = ['Active', 'New', 'Paused', 'Inactive'] as const

/** The client badge; a button (with a small arrow) when the person can change it. */
export function ClientStatusBadge({ r, onEdit }: { r: ReportRow; onEdit?: (r: ReportRow) => void }) {
  if (!onEdit || !r.clientId) return <ClientBadge status={r.clientStatus} />
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(r) }} title="Change this client's status"
      className="inline-flex items-center gap-0.5 rounded hover:opacity-80">
      <ClientBadge status={r.clientStatus ?? 'No status'} />
      <ChevronDown size={11} className="text-muted" />
    </button>
  )
}

export function ClientStatusModal({ r, onClose, onDone }: { r: ReportRow; onClose: () => void; onDone: (text: string) => void }) {
  const ds = useData()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const name = r.clientName ?? r.name
  const choose = async (status: (typeof CLIENT_STATUSES)[number]) => {
    if (status === r.clientStatus) return onClose()
    setBusy(status)
    setError(null)
    try {
      await ds.setClient(r.clientId!, { status })
      onDone(status === 'Paused' || status === 'Inactive'
        ? `${name} is now ${status}. It no longer shows in Insights, Today or Ad approval. Undo on the Clients screen (Paused / Inactive).`
        : `${name} is now ${status}.`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }
  return (
    <Modal open onClose={onClose} title={`Status: ${name}`}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          {CLIENT_STATUSES.map((s) => (
            <button key={s} type="button" disabled={!!busy} onClick={() => choose(s)}
              className={`rounded-lg border px-3 py-2 text-left font-semibold disabled:opacity-60 ${s === r.clientStatus ? 'border-brand bg-selected' : 'border-line'}`}>
              {busy === s ? 'Saving...' : s}{s === r.clientStatus && <span className="ml-1 text-xs font-normal text-muted">(now)</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          Paused and Inactive clients drop out of Insights, Today and Ad approval. The change is kept in The Lab and wins over GHL; GHL keeps its own value until writing back to GHL is switched on.
        </p>
        {error && <p className="text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
