/**
 * Session: who is using the app, and light or dark mode.
 *
 * - `me` is the signed-in employee. Their GHL user id (employees.id) is what
 *   clients are assigned to in GHL, so it decides whose suggestions they see.
 * - In sample mode there's no login; "Viewing as" in the banner switches person.
 * - `mode`: light, dark or match the device (docs/design-options.md).
 *   Remembered per browser; web/index.html applies it before the page draws.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Employee } from '@shared/domain/types.ts'
import { useData } from '../data/source'
import { VIEW_AS_KEY } from '../data/mockSource'
import { useAsync } from '../lib/useAsync'

const MODE_KEY = 'mrkd.mode'

/** "system" follows the phone or computer setting. */
export type Mode = 'light' | 'dark' | 'system'

interface Session {
  me: Employee | null
  loadingMe: boolean
  /** admin or owner: sees everyone's suggestions. */
  isAdmin: boolean
  /** Sample mode only. */
  setViewAs: (employeeId: string) => void
  /** What the person chose: light, dark or match the device. */
  mode: Mode
  setMode: (m: Mode) => void
  /** What is showing right now. */
  dark: boolean
}

const SessionContext = createContext<Session | null>(null)

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(MODE_KEY) as Mode | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    /* ignore */
  }
  return 'system'
}

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function SessionProvider({ children }: { children: ReactNode }) {
  const ds = useData()
  const [viewAsVersion, setViewAsVersion] = useState(0)
  const { data: me, loading } = useAsync(() => ds.me(), [ds, viewAsVersion])
  const [mode, setModeState] = useState<Mode>(initialMode)
  const [systemDark, setSystemDark] = useState(prefersDark)
  const dark = mode === 'dark' || (mode === 'system' && systemDark)

  // Follow the device's light/dark setting while "Match device" is chosen.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const session: Session = {
    me: me ?? null,
    loadingMe: loading,
    isAdmin: me?.role === 'admin' || me?.role === 'owner',
    setViewAs: (id) => {
      try {
        localStorage.setItem(VIEW_AS_KEY, id)
      } catch {
        /* ignore */
      }
      setViewAsVersion((v) => v + 1)
    },
    mode,
    setMode: setModeState,
    dark,
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}
