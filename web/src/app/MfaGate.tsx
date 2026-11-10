/**
 * Two-step sign-in (docs/sop/security.md#two-step-sign-in-in-the-lab).
 *
 * After signing in:
 *  - Owners and admins must use an authenticator app. First time: scan a QR
 *    code and enter a code to finish setting it up. Every sign-in after that:
 *    enter the 6-digit code.
 *  - Anyone else who turned it on in Settings is asked for the code too.
 * The database enforces it for owner/admin powers (migration 2600, is_admin()
 * needs an "aal2" session), so this screen is convenience, not the only lock.
 * Sample mode (no Supabase): skipped.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from './session'
import { LabMark } from '../components/LabMark'

type State =
  | { step: 'checking' }
  | { step: 'ok' }
  | { step: 'verify'; factorId: string }
  | { step: 'enroll' }

export function MfaGate({ children }: { children: ReactNode }) {
  const { me, loadingMe } = useSession()
  const [state, setState] = useState<State>({ step: 'checking' })
  const mustHave = me?.role === 'owner' || me?.role === 'admin'

  const check = useCallback(async () => {
    if (!supabase) return setState({ step: 'ok' })
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal2') return setState({ step: 'ok' })
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = factors?.totp?.[0]
    if (verified) return setState({ step: 'verify', factorId: verified.id })
    setState(mustHave ? { step: 'enroll' } : { step: 'ok' })
  }, [mustHave])

  useEffect(() => {
    if (!loadingMe) void check()
  }, [loadingMe, check])

  if (!supabase || state.step === 'ok') return <>{children}</>
  if (state.step === 'checking') return <Shell><p className="text-sm text-muted">Loading...</p></Shell>
  if (state.step === 'verify') return <Verify factorId={state.factorId} onDone={() => setState({ step: 'ok' })} />
  return <Enroll onDone={() => setState({ step: 'ok' })} />
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <LabMark size={44} className="mb-3" />
        {children}
        <button onClick={() => supabase?.auth.signOut()} className="mt-5 text-xs font-medium text-muted hover:text-ink">Sign out</button>
      </div>
    </div>
  )
}

function CodeInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={(e) => e.key === 'Enter' && value.length === 6 && onEnter()}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      placeholder="123456"
      aria-label="6-digit code"
      className="tabular w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-center text-xl tracking-[0.4em] outline-none focus:border-brand"
    />
  )
}

function Verify({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) {
      setError("That code didn't work. Codes change every 30 seconds; try the current one.")
      setCode('')
    } else onDone()
  }
  return (
    <Shell>
      <h1 className="text-xl font-bold tracking-tight">Enter your code</h1>
      <p className="mt-1 mb-4 text-sm text-muted">Open your authenticator app and enter the 6-digit code for The Lab.</p>
      <CodeInput value={code} onChange={setCode} onEnter={go} />
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <button onClick={go} disabled={busy || code.length !== 6}
        className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40">
        {busy ? 'Checking...' : 'Continue'}
      </button>
      <p className="mt-3 text-xs text-muted">Lost your phone? Ask an owner to reset your two-step sign-in (docs/sop/security.md).</p>
    </Shell>
  )
}

/** First-time setup: QR code, then confirm with a code. Also used from Settings. */
export function EnrollPanel({ onDone, required }: { onDone: () => void; required: boolean }) {
  const [qr, setQr] = useState<{ factorId: string; svg: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Clear any half-finished setup first, then start a new one.
      const { data } = await supabase!.auth.mfa.listFactors()
      for (const f of data?.all ?? []) if (f.status === 'unverified') await supabase!.auth.mfa.unenroll({ factorId: f.id })
      const { data: e, error } = await supabase!.auth.mfa.enroll({ factorType: 'totp', friendlyName: `The Lab ${new Date().toISOString().slice(0, 10)}`, issuer: 'The Lab by MRKD' })
      if (cancelled) return
      if (error || !e) setError(error?.message ?? 'Could not start setup.')
      else setQr({ factorId: e.id, svg: e.totp.qr_code, secret: e.totp.secret })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const go = async () => {
    if (!qr) return
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId: qr.factorId, code })
    setBusy(false)
    if (error) {
      setError("That code didn't work. Codes change every 30 seconds; try the current one.")
      setCode('')
    } else onDone()
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">Set up two-step sign-in</h1>
      <p className="mt-1 text-sm text-muted">
        {required ? 'Owners and admins confirm each sign-in with a code from their phone. ' : ''}
        Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password), then:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>In the app, add an account and scan this code.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <div className="my-3 flex justify-center rounded-lg bg-white p-3">
        {qr ? <img src={qr.svg} alt="QR code for your authenticator app" className="h-44 w-44" /> : <div className="h-44 w-44" />}
      </div>
      {qr && (
        <details className="mb-3 text-xs text-muted">
          <summary className="cursor-pointer">Can't scan? Enter this key instead</summary>
          <code className="mt-1 block break-all rounded bg-subtle p-2 text-soft">{qr.secret}</code>
        </details>
      )}
      <CodeInput value={code} onChange={setCode} onEnter={go} />
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <button onClick={go} disabled={busy || code.length !== 6 || !qr}
        className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-40">
        {busy ? 'Checking...' : 'Finish setup'}
      </button>
    </div>
  )
}

function Enroll({ onDone }: { onDone: () => void }) {
  return (
    <Shell>
      <EnrollPanel required onDone={onDone} />
    </Shell>
  )
}
