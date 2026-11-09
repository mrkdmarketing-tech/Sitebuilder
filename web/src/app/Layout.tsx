import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, CheckSquare, Lightbulb, Search, Activity } from 'lucide-react'
import { SAMPLE_MODE } from '../lib/config'

const NAV = [
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/approvals', label: 'Ad approval', icon: CheckSquare },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/status', label: 'Sync', icon: Activity },
]

/** App shell: top bar on desktop, bottom tab bar on phones. */
export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      {SAMPLE_MODE && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          Sample data: fictional gyms and numbers, for checking the layout. Real data connects in Phase 1a.
        </div>
      )}
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <span className="text-lg font-black tracking-tight">MRKD</span>
          <nav className="hidden gap-1 md:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-24 pt-4 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
