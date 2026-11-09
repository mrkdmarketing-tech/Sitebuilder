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

export type Design = 'classic' | 'midnight' | 'bold' | 'compact'
export const DESIGNS: { key: Design; label: string; blurb: string }[] = [
  { key: 'classic', label: 'A · Classic', blurb: 'Black top bar, white cards, blue links. Closest to a modern Retool.' },
  { key: 'midnight', label: 'B · Midnight', blurb: 'Dark dashboard with green accents. Easy on the eyes when it is open all day.' },
  { key: 'bold', label: 'C · MRKD Bold', blurb: 'Brand-forward: black sidebar, warm background, orange accent, big numbers.' },
  { key: 'compact', label: 'D · Compact', blurb: 'Dense like Retool: smaller text, tighter rows, more columns on screen.' },
]
const DESIGN_KEY = 'mrkd.design'

interface Session {
  me: Employee | null
  loadingMe: boolean
  /** admin or owner: sees everyone's suggestions. */
  isAdmin: boolean
  /** Sample mode only. */
  setViewAs: (employeeId: string) => void
  design: Design
  setDesign: (d: Design) => void
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
  return 'classic'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const ds = useData()
  const [viewAsVersion, setViewAsVersion] = useState(0)
  const { data: me, loading } = useAsync(() => ds.me(), [ds, viewAsVersion])
  const [design, setDesignState] = useState<Design>(initialDesign)

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
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}
