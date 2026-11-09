/** Small shared UI pieces. */
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { DeliveryStatus } from '@shared/domain/types.ts'

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PAUSED: 'bg-subtle text-soft',
  REMOVED: 'bg-indigo-100 text-indigo-800',
  DISABLED: 'bg-red-100 text-red-800',
  OTHER: 'bg-amber-100 text-amber-800',
}

export function StatusBadge({ status, label }: { status: DeliveryStatus; label?: string }) {
  const text = (label && label !== status ? label : status).replace(/_/g, ' ')
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[status]}`}>
      {text}
    </span>
  )
}

const CLIENT_STYLE: Record<string, string> = {
  Active: 'bg-emerald-600 text-white',
  New: 'bg-sky-600 text-white',
  Paused: 'bg-gray-400 text-white',
  Inactive: 'bg-gray-300 text-soft',
}

export function ClientBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${CLIENT_STYLE[status] ?? 'bg-gray-200'}`}>{status}</span>
}

export function ManagerChip({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-muted">Unassigned</span>
  return <span className="whitespace-nowrap rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-900">{name}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-subtle" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-muted">{children}</div>
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}
