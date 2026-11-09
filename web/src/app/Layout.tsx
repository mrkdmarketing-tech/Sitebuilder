import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, CheckSquare, Lightbulb, Search, Activity } from 'lucide-react'
import { SAMPLE_MODE } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useData } from '../data/source'
import { useAsync } from '../lib/useAsync'
import { DESIGNS, useSession, type Design } from './session'

const NAV = [
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/approvals', label: 'Ad approval', icon: CheckSquare },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/status', label: 'Sync', icon: Activity },
]

/**
 * App shell. Desktop: top bar (designs A, B, D) or black left sidebar (design C).
 * Phones: bottom tab bar in every design.
 */
export function Layout() {
  const { design } = useSession()
  const sidebar = design === 'bold'
  return (
    <div className="flex min-h-full flex-col">
      {SAMPLE_MODE && <SampleBar />}
      <div className={sidebar ? 'flex flex-1' : 'flex flex-1 flex-col'}>
        {sidebar ? <SideNav /> : <TopNav />}
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-24 pt-4 md:pb-8">
          {sidebar && <div className="mb-2 text-lg font-black tracking-tight md:hidden">MRKD</div>}
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
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
        <span className="text-lg font-black tracking-tight">MRKD</span>
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
