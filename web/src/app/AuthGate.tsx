/**
 * Sign-in (docs/auth.md). Shown before anything else when the app is connected
 * to Supabase; skipped in sample-data mode.
 *
 * - "Continue with Google": restricted to mrkd.ca Google accounts.
 * - Email code: backup for anyone without Google access. Supabase emails a
 *   6-digit code (and a link); typing the code signs in on this device, which
 *   matters on iPhones where the home-screen app and Safari don't share sign-ins.
 * After sign-in, the database links the login to the staff record with the
 * same email (migration 1400). A login with no staff record sees a clear
 * "not on the staff list" message, and the database shows it no data anyway.
 */
import { LabMark } from '../components/LabMark'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useData } from '../data/source'
import { useAsync } from '../lib/useAsync'

const STAFF_DOMAIN = 'mrkd.ca'
/** The app's name, shown on the sign-in screen and in the top bar. */
export const APP_NAME = 'The Lab'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children}</> // sample-data mode: no login
  if (session === undefined) return <Centered><p className="text-sm text-muted">Loading…</p></Centered>
  if (!session) return <SignIn />
  return <StaffCheck email={session.user.email ?? ''}>{children}</StaffCheck>
}

/** Signed in, but are they on the staff list? */
function StaffCheck({ email, children }: { email: string; children: ReactNode }) {
  const ds = useData()
  const { data: me, loading } = useAsync(() => ds.me(), [ds, email])
  if (loading) return <Centered><p className="text-sm text-muted">Loading…</p></Centered>
  if (!me) {
    return (
      <Centered>
        <h1 className="text-xl font-bold">Not on the MRKD staff list</h1>
        <p className="mt-2 text-sm text-soft">
          You're signed in as <strong>{email}</strong>, but that email isn't on the staff list, so there's nothing to show.
          Ask an owner to add it, then sign in again.
        </p>
        <button onClick={() => supabase!.auth.signOut()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          Sign out
        </button>
      </Centered>
    )
  }
  return <>{children}</>
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const google = async () => {
    setError(null)
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { hd: STAFF_DOMAIN, prompt: 'select_account' } },
    })
    if (error) setError(error.message)
  }

  const emailLink = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) setError(/rate limit|too many/i.test(error.message)
      ? 'Too many sign-in emails were sent in the last hour. Use the code from an earlier email if you have one, or try again shortly.'
      : error.message)
    else setSent(true)
  }

  // Typing the code signs in on THIS device and app. Opening the email link can
  // sign in a different browser instead (e.g. Safari vs the home-screen app).
  const [code, setCode] = useState('')
  const verifyCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    setBusy(false)
    if (error) setError("That code didn't work. Use the newest email's code; codes work once, for 1 hour.")
  }

  return (
    <Centered>
      <LabMark size={56} className="mb-4" />
      <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
      <div className="mt-1 text-sm font-semibold text-muted">by MRKD</div>
      <p className="mt-2 text-sm text-muted">Sign in with your @{STAFF_DOMAIN} account.</p>

      <button
        onClick={google}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-hover"
      >
        <GoogleMark /> Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or get a sign-in code by email <span className="h-px flex-1 bg-line" />
      </div>

      {sent ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-2">
          <p className="text-sm">We emailed a 6-digit code to <strong>{email}</strong>. Type it here:</p>
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" aria-label="Sign-in code"
            className="tabular h-11 rounded-lg border border-line bg-surface px-3 text-center text-xl tracking-[0.4em]"
          />
          <button disabled={busy || code.length !== 6} className="h-10 rounded-lg bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" onClick={() => { setSent(false); setCode('') }} className="text-xs font-medium text-muted hover:text-ink">
            Use a different email, or send a new code
          </button>
        </form>
      ) : (
        <form onSubmit={emailLink} className="flex flex-col gap-2">
          <label htmlFor="signin-email" className="text-xs font-semibold text-muted">Work email</label>
          <input
            id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={`you@${STAFF_DOMAIN}`} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
          />
          <button disabled={busy} className="h-10 rounded-lg bg-primary text-sm font-semibold text-on-primary disabled:opacity-60">
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
    </Centered>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">{children}</div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
