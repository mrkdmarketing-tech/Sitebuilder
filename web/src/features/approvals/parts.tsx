/** Small pieces shared by the Approvals screens. */
import type { ReactNode } from 'react'
import { STATUS_LABEL, type ReviewStatus } from '@shared/domain/approvals.ts'

const STATUS_STYLE: Record<ReviewStatus, string> = {
  draft: 'bg-subtle text-soft',
  review_pending: 'bg-amber-100 text-amber-900',
  request_changes: 'bg-red-100 text-red-800',
  approved: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-sky-100 text-sky-900',
}

export function StatusPill({ status }: { status: ReviewStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none focus:border-brand disabled:bg-subtle disabled:text-soft'

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Button({
  children, onClick, kind = 'secondary', disabled, title, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'quiet'; disabled?: boolean; title?: string
  type?: 'button' | 'submit'
}) {
  const style = {
    primary: 'bg-primary text-on-primary',
    secondary: 'border border-line bg-surface',
    danger: 'bg-red-600 text-white',
    quiet: 'text-muted hover:bg-subtle',
  }[kind]
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${style}`}>
      {children}
    </button>
  )
}

/** "3 min ago", "yesterday", or a date. */
export function ago(iso: string | null): string {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 172800) return 'yesterday'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: s > 300 * 86400 ? 'numeric' : undefined })
}

/** Plain text from Retool's stored HTML (never rendered as HTML). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<\/(p|h\d|li|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n'), 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}
