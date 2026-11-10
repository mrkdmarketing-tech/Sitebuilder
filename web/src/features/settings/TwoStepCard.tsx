/**
 * Settings -> Two-step sign-in (docs/sop/security.md#two-step-sign-in-in-the-lab).
 * Shows whether it's on for you; staff can turn it on; anyone can move it to a
 * new phone. Owners and admins always have it (MfaGate asks them to set it up).
 */
import { useState } from 'react'
import { Card } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { useSession } from '../../app/session'
import { EnrollPanel } from '../../app/MfaGate'

export function TwoStepCard() {
  const { me } = useSession()
  const [version, setVersion] = useState(0)
  const [setting, setSetting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const factors = useAsync(async () => (supabase ? (await supabase.auth.mfa.listFactors()).data?.totp ?? [] : []), [version])
  const required = me?.role === 'owner' || me?.role === 'admin'
  const on = (factors.data?.length ?? 0) > 0

  const replace = async () => {
    if (!window.confirm('Move two-step sign-in to a new phone? Your current authenticator entry stops working once you finish.')) return
    setSetting(true)
  }
  const finished = async () => {
    // When moving to a new phone, remove the old entry after the new one works.
    const { data } = await supabase!.auth.mfa.listFactors()
    const verified = data?.totp ?? []
    for (const f of verified.slice(0, -1)) await supabase!.auth.mfa.unenroll({ factorId: f.id })
    setSetting(false)
    setNotice('Two-step sign-in is on.')
    setVersion((v) => v + 1)
  }

  return (
    <Card className="mt-4 p-4">
      <h2 className="mb-1 text-base font-semibold">Two-step sign-in</h2>
      {!supabase ? (
        <p className="text-sm text-muted">Only on the live app.</p>
      ) : setting ? (
        <EnrollPanel required={required} onDone={finished} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {on ? 'On: you confirm each sign-in with a code from your authenticator app.' : 'Off.'}{' '}
            {required ? 'Required for owners and admins.' : 'Optional for staff, recommended.'}
          </p>
          {notice && <p className="mb-2 text-sm text-good">{notice}</p>}
          <button onClick={on ? replace : () => setSetting(true)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold">
            {on ? 'Move to a new phone' : 'Turn on'}
          </button>
        </>
      )}
    </Card>
  )
}
