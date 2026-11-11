import { useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DataContext, type DataSource } from '../data/source'
import { createMockSource } from '../data/mockSource'
import { createSupabaseSource } from '../data/supabaseSource'
import { supabase } from '../lib/supabase'
import { Layout } from './Layout'
import { SessionProvider } from './session'
import { AuthGate } from './AuthGate'
import { MfaGate } from './MfaGate'
import { ErrorBoundary } from './ErrorBoundary'
import { InsightsPage } from '../features/insights/InsightsPage'
import { TodayPage } from '../features/today/TodayPage'
import { SearchPage } from '../features/search/SearchPage'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { ReviewPage } from '../features/approvals/ReviewPage'
import { SyncStatusPage } from '../features/status/SyncStatusPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ClientsPage } from '../features/clients/ClientsPage'

/**
 * Routes (docs/architecture.md):
 *   /insights     Meta insights (Phase 1a)       replaces Retool "Meta Ads Insights"
 *   /today        Today (home): what needs doing, one row each   replaces Retool alerts
 *   /suggestions  old address, goes to /today
 *   /approvals    Ad approval (Phase 2)          replaces Retool "Ad Preview"
 *   /approvals/:id  One ad: edit, mistake check, submit, review
 *   /search       Lead form & ad copy search      replaces Retool "Search Meta Lead Forms"
 *   /status       Sync health
 *   /settings     Suggestion thresholds (admins edit), staff, light/dark, links
 *   /clients      Client status, ads manager, ad accounts (admins change; overrides GHL/Retool)
 * Sign-in: AuthGate (Google restricted to mrkd.ca, plus email link), then MfaGate
 * (authenticator code; required for owners/admins). GHL single sign-on later.
 */
export function App() {
  const source: DataSource = useMemo(() => (supabase ? createSupabaseSource(supabase) : createMockSource()), [])
  return (
    <ErrorBoundary>
    <DataContext.Provider value={source}>
      <AuthGate>
      <SessionProvider>
      <MfaGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="suggestions" element={<Navigate to="/today" replace />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="approvals/:id" element={<ReviewPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="status" element={<SyncStatusPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
      </MfaGate>
      </SessionProvider>
      </AuthGate>
    </DataContext.Provider>
    </ErrorBoundary>
  )
}
