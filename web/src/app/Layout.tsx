import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, CheckSquare, Lightbulb, Search, Activity, Settings } from 'lucide-react'
import { SAMPLE_MODE } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useData } from '../data/source'
import { useAsync } from '../lib/useAsync'
import { DESIGNS, useSession, type Design } from './session'
import { APP_NAME } from './AuthGate'
import { UpdateBanner } from './UpdateBanner'

/** `phone: false` = left off the phone tab bar (5 slots); reachable from Settings. */
/** Designs that use a left sidebar on desktop instead of a top bar. */
const SIDEBAR_DESIGNS = new Set(['bold', 'air', 'studio'])

const NAV = [
  { to: '/insights', label: 'Insights', icon: BarChart3, phone: true },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb, phone: true },
  { to: '/approvals', label: 'Ad approval', icon: CheckSquare, phone: true },
  { to: '/search', label: 'Search', icon: Search, phone: true },
  { to: '/status', label: 'Sync', icon: Activity, phone: false },
  { to: '/settings', label: 'Settings', icon: Settings, phone: true },
]

/**
 * App shell. Desktop: top bar (designs A, B, D, E, F) or left sidebar (C, G, H).
 * Phones: bottom tab bar in every design.
 */
export function Layout() {
  const { design } = useSession()
  const sidebar = SIDEBAR_DESIGNS.has(design)
  return (
    <div className="flex min-h-full flex-col">
      <UpdateBanner />
      {SAMPLE_MODE && <SampleBar />}
      <div className={sidebar ? 'flex flex-1' : 'flex flex-1 flex-col'}>
        {sidebar ? <SideNav /> : <TopNav />}
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-24 pt-4 md:pb-8">
          {sidebar && <div className="mb-2 text-lg font-black tracking-tight md:hidden">MRKD <span className="text-sm font-semibold text-muted">{APP_NAME}</span></div>}
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => n.phone).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function UserBadge() {
  const { me } = useSession()
  if (!me) return null
  return (
    <button
      type="button"
      title={supabase ? 'Sign out' : undefined}
      onClick={() => supabase?.auth.signOut()}
      className="flex items-center gap-2 text-sm"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-primary">
        {me.firstName[0]}{me.lastName[0]}
      </span>
      <span className="hidden text-header-ink/80 lg:inline">{me.firstName} {me.lastName}</span>
      {supabase && <span className="hidden text-xs text-header-ink/60 lg:inline">· Sign out</span>}
    </button>
  )
}

function TopNav() {
  return (
    <header className="sticky top-0 z-30 bg-header text-header-ink">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
        <span className="flex items-baseline gap-2">
          <span className="text-lg font-black tracking-tight">MRKD</span>
          <span className="text-sm font-semibold text-header-ink/70">{APP_NAME}</span>
        </span>
        <nav className="hidden flex-1 gap-1 md:flex">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-header-ink/15 text-header-ink' : 'text-header-ink/70 hover:text-header-ink'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto"><UserBadge /></div>
      </div>
    </header>
  )
}

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-header px-3 py-5 text-header-ink md:flex">
      <span className="px-2 text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>MRKD</span>
      <span className="px-2 text-sm font-semibold text-header-ink/70">{APP_NAME}</span>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-primary text-on-primary' : 'text-header-ink/70 hover:bg-header-ink/10 hover:text-header-ink'}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-2"><UserBadge /></div>
    </aside>
  )
}

/** Sample-mode controls: who you're viewing as, and which design. Gone once real logins exist. */
function SampleBar() {
  const ds = useData()
  const { me, setViewAs, design, setDesign } = useSession()
  const { data: employees } = useAsync(() => ds.employees(), [ds])
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-100 px-4 py-1.5 text-xs text-amber-950">
      <span className="font-medium">Sample data: fictional gyms and numbers.</span>
      <label className="flex items-center gap-1">
        Viewing as
        <select value={me?.id ?? ''} onChange={(e) => setViewAs(e.target.value)} className="rounded border border-amber-300 bg-white px-1 py-0.5 text-amber-950">
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName} ({e.role === 'owner' || e.role === 'admin' ? 'owner: sees everyone' : 'ads manager'})
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        Design
        <select value={design} onChange={(e) => setDesign(e.target.value as Design)} className="rounded border border-amber-300 bg-white px-1 py-0.5 text-amber-950">
          {DESIGNS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </label>
    </div>
  )
}
