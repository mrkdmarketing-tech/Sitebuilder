/**
 * Settings -> Staff (docs/sop/staff-and-access.md).
 * Everyone can see the list. Owners and admins can change roles; the database
 * (set_employee_role, migration 2300) enforces who may do what and logs it.
 * Names, emails, ads manager and active come from Retool and are read-only here.
 */
import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { Card } from '../../components/ui'
import { useData, type StaffMember } from '../../data/source'
import { useAsync } from '../../lib/useAsync'
import { useSession } from '../../app/session'

const ROLES: { key: StaffMember['role']; label: string; what: string }[] = [
  { key: 'staff', label: 'Staff', what: 'sees all insights and their own suggestions, uses ad approval' },
  { key: 'admin', label: 'Admin', what: 'also sees everyone\'s suggestions, changes thresholds and staff roles (not owners)' },
  { key: 'owner', label: 'Owner', what: 'same as admin, and can make or change owners' },
]

export function StaffSection() {
  const ds = useData()
  const { me, isAdmin } = useSession()
  const [version, setVersion] = useState(0)
  const list = useAsync(() => ds.staff(), [ds, version])
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const iAmOwner = me?.role === 'owner'

  const change = async (s: StaffMember, role: StaffMember['role']) => {
    if (role === s.role) return
    const r = ROLES.find((x) => x.key === role)!
    const self = s.id === me?.id ? ' (you)' : ''
    if (!window.confirm(`Make ${s.firstName} ${s.lastName}${self} ${r.label === 'Admin' ? 'an' : 'a'} ${r.label.toLowerCase()}?\n\n${r.label}: ${r.what}.`)) return
    setBusy(s.id)
    setNotice(null)
    try {
      await ds.setRole(s.id, role)
      setNotice({ ok: true, text: `${s.firstName} is now ${r.label === 'Admin' ? 'an' : 'a'} ${r.label.toLowerCase()}. Recorded in the log.` })
      setVersion((v) => v + 1)
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const rows = list.data ?? []
  return (
    <Card className="mt-4 p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Staff</h2>
        <span className="text-xs text-muted">{rows.filter((r) => r.active).length} active</span>
      </div>
      <p className="mb-3 text-sm text-muted">
        Names, emails, ads manager and active come from Retool's employees table (copied every 15 minutes); change them there.
        Clients are assigned in GHL. {isAdmin ? 'You can change roles here.' : 'Owners and admins can change roles.'}
      </p>
      {list.error && <p className="text-sm text-bad">Couldn't load staff: {list.error.message}</p>}
      {notice && <p className={`mb-2 text-sm ${notice.ok ? 'text-good' : 'text-bad'}`}>{notice.text}</p>}

      <div className="divide-y divide-line">
        {rows.map((s) => {
          const canEdit = isAdmin && s.active && (iAmOwner || s.role !== 'owner')
          return (
            <div key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${s.active ? '' : 'opacity-50'}`}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {s.firstName} {s.lastName}{s.id === me?.id && <span className="text-muted"> (you)</span>}
                  {!s.active && <span className="ml-1.5 text-xs text-muted">inactive</span>}
                </div>
                <div className="truncate text-xs text-muted">{s.email ?? 'No email: fix it in Retool so they can sign in'}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span title="Active or New clients assigned in GHL">{s.isAdManager ? `${s.clients} client${s.clients === 1 ? '' : 's'}` : 'Not an ads manager'}</span>
                <span className="flex items-center gap-1" title="Has signed in to The Lab">
                  {s.signedIn ? <Check size={13} className="text-good" /> : <Minus size={13} />} {s.signedIn ? 'Signed in' : 'Not signed in yet'}
                </span>
              </div>
              {canEdit ? (
                <select
                  value={s.role}
                  disabled={busy === s.id}
                  onChange={(e) => change(s, e.target.value as StaffMember['role'])}
                  aria-label={`Role for ${s.firstName} ${s.lastName}`}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-sm"
                >
                  {ROLES.filter((r) => iAmOwner || r.key !== 'owner').map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              ) : (
                <span className="w-16 text-right text-sm font-medium capitalize">{s.role}</span>
              )}
            </div>
          )
        })}
      </div>

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium">What each role can do</summary>
        <ul className="mt-1.5 space-y-1">
          {ROLES.map((r) => <li key={r.key}><span className="font-semibold text-soft">{r.label}:</span> {r.what}.</li>)}
          <li>There must always be at least one owner.</li>
        </ul>
      </details>
    </Card>
  )
}
