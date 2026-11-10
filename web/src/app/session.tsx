/**
 * Session: who is using the app and which design is shown.
 *
 * - `me` is the signed-in employee. Their GHL user id (employees.id) is what
 *   clients are assigned to in GHL, so it decides whose suggestions they see.
 * - In sample mode there's no login; "Viewing as" in the banner switches person.
 * - `design` is one of the four design options (docs/design-options.md).
 *   Picked with ?design=… or the switcher in the banner; remembered per browser.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Employee } from '@shared/domain/types.ts'
import { useData } from '../data/source'
import { VIEW_AS_KEY } from '../data/mockSource'
import { useAsync } from '../lib/useAsync'

export type Design = 'classic' | 'midnight' | 'bold' | 'compact' | 'graphite' | 'onyx' | 'air' | 'studio'
/** `proposal`: the sleeker options from 11 Nov 2026, shown separately in Settings. None is the default. */
export const DESIGNS: { key: Design; label: string; blurb: string; proposal?: boolean }[] = [
  { key: 'classic', label: 'A · Classic', blurb: 'Black top bar, white cards, blue links. Closest to a modern Retool.' },
  { key: 'midnight', label: 'B · Midnight', blurb: 'Dark dashboard with green accents. Easy on the eyes when it is open all day.' },
  { key: 'bold', label: 'C · MRKD Bold', blurb: 'Brand-forward: black sidebar, warm background, orange accent, big numbers.' },
  { key: 'compact', label: 'D · Compact', blurb: 'Dense like Retool: smaller text, tighter rows, more columns on screen.' },
  { key: 'graphite', label: 'E · Graphite', blurb: 'White top bar, hairline borders, soft shadows, indigo accent. Clean and quiet.', proposal: true },
  { key: 'onyx', label: 'F · Onyx', blurb: 'True-black dark mode with white buttons and a blue accent. Sharp at night.', proposal: true },
  { key: 'air', label: 'G · Air (default)', blurb: 'Light sidebar, lots of white space, teal accent. Calm and roomy. Has a dark mode.', proposal: true },
  { key: 'studio', label: 'H · Studio', blurb: 'Charcoal sidebar, crisp white content, MRKD orange used sparingly.', proposal: true },
]
/** v2: Air became the default on 11 Nov 2026, so earlier saved picks (always "classic") are ignored. */
const DESIGN_KEY = 'mrkd.design.v2'
const MODE_KEY = 'mrkd.mode'
export const DEFAULT_DESIGN: Design = 'air'

/** Light or dark (Air only). "system" follows the phone or computer setting. */
export type Mode = 'light' | 'dark' | 'system'
/** Designs that have a dark version. */
export const DESIGNS_WITH_DARK = new Set<Design>(['air'])

interface Session {
  me: Employee | null
  loadingMe: boolean
  /** admin or owner: sees everyone's suggestions. */
  isAdmin: boolean
  /** Sample mode only. */
  setViewAs: (employeeId: string) => void
  design: Design
  setDesign: (d: Design) => void
  /** What the person chose: light, dark or match the device. */
  mode: Mode
  setMode: (m: Mode) => void
  /** What is showing right now. */
  dark: boolean
}

const SessionContext = createContext<Session | null>(null)

function initialDesign(): Design {
  const fromUrl = new URLSearchParams(window.location.search).get('design') as Design | null
  if (fromUrl && DESIGNS.some((d) => d.key === fromUrl)) return fromUrl
  try {
    const saved = localStorage.getItem(DESIGN_KEY) as Design | null
    if (saved && DESIGNS.some((d) => d.key === saved)) return saved
  } catch {
    /* ignore */
  }
  return DEFAULT_DESIGN
}

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
  const [design, setDesignState] = useState<Design>(initialDesign)
  const [mode, setModeState] = useState<Mode>(initialMode)
  const [systemDark, setSystemDark] = useState(prefersDark)
  const dark = DESIGNS_WITH_DARK.has(design) && (mode === 'dark' || (mode === 'system' && systemDark))

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

  useEffect(() => {
    document.documentElement.dataset.design = design
    try {
      localStorage.setItem(DESIGN_KEY, design)
    } catch {
      /* ignore */
    }
  }, [design])

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
    design,
    setDesign: setDesignState,
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
