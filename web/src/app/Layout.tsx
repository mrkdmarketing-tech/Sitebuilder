import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, CheckSquare, Lightbulb, Search, Activity, Settings, Moon, Sun, Users } from 'lucide-react'
import { SAMPLE_MODE } from '../lib/config'
import { supabase } from '../lib/supabase'
import { useData } from '../data/source'
import { useAsync } from '../lib/useAsync'
import { useSession } from './session'
import { UpdateBanner } from './UpdateBanner'
import { LabLockup } from '../components/LabMark'

/** `phone: false` = left off the phone tab bar (5 slots); reachable from Settings. */
const NAV = [
  { to: '/insights', label: 'Insights', icon: BarChart3, phone: true },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb, phone: true },
  { to: '/approvals', label: 'Ad approval', icon: CheckSquare, phone: true },
  { to: '/search', label: 'Search', icon: Search, phone: true },
  { to: '/clients', label: 'Clients', icon: Users, phone: false },
  { to: '/status', label: 'Sync', icon: Activity, phone: false },
  { to: '/settings', label: 'Settings', icon: Settings, phone: true },
]

/**
 * App shell ("Air", docs/design-options.md). Desktop: left sidebar.
 * Phones: name and light/dark button on top, tab bar at the bottom.
 */
export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <UpdateBanner />
      {SAMPLE_MODE && <SampleBar />}
      <div className="flex flex-1">
        <SideNav />
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-24 pt-4 md:pb-8">
          <div className="mb-2 flex items-center justify-between md:hidden">
            <LabLockup size={32} />
            <ModeToggle />
          </div>
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

function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-header px-3 py-5 text-header-ink md:flex">
      <span className="px-2"><LabLockup /></span>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-primary text-on-primary' : 'text-header-ink/70 hover:bg-header-ink/10 hover:text-header-ink'}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex items-center justify-between gap-2 px-2"><UserBadge /><ModeToggle /></div>
    </aside>
  )
}

/** Sun / moon button: switches between light and dark. */
function ModeToggle() {
  const { dark, setMode } = useSession()
  return (
    <button
      type="button"
      onClick={() => setMode(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

/** Sample-mode control: who you're viewing as. Only in sample mode. */
function SampleBar() {
  const ds = useData()
  const { me, setViewAs } = useSession()
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
    </div>
  )
}
