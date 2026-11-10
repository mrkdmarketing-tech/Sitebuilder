import { useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DataContext, type DataSource } from '../data/source'
import { createMockSource } from '../data/mockSource'
import { createSupabaseSource } from '../data/supabaseSource'
import { supabase } from '../lib/supabase'
import { Layout } from './Layout'
import { SessionProvider } from './session'
import { AuthGate } from './AuthGate'
import { InsightsPage } from '../features/insights/InsightsPage'
import { SuggestionsPage } from '../features/suggestions/SuggestionsPage'
import { SearchPage } from '../features/search/SearchPage'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { ReviewPage } from '../features/approvals/ReviewPage'
import { SyncStatusPage } from '../features/status/SyncStatusPage'
import { SettingsPage } from '../features/settings/SettingsPage'

/**
 * Routes (docs/architecture.md):
 *   /insights     Meta insights (Phase 1a)       replaces Retool "Meta Ads Insights"
 *   /suggestions  Suggestions (Phase 1b)         replaces Retool alerts
 *   /approvals    Ad approval (Phase 2)          replaces Retool "Ad Preview"
 *   /approvals/:id  One ad: edit, mistake check, submit, review
 *   /search       Lead form & ad copy search      replaces Retool "Search Meta Lead Forms"
 *   /status       Sync health
 *   /settings     Suggestion thresholds (admins edit), staff, light/dark, links
 * Sign-in: AuthGate (Google restricted to mrkd.ca, plus email link). GHL single sign-on later.
 */
export function App() {
  const source: DataSource = useMemo(() => (supabase ? createSupabaseSource(supabase) : createMockSource()), [])
  return (
    <DataContext.Provider value={source}>
      <AuthGate>
      <SessionProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/insights" replace />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="suggestions" element={<SuggestionsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="approvals/:id" element={<ReviewPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="status" element={<SyncStatusPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/insights" replace />} />
        </Route>
      </Routes>
      </SessionProvider>
      </AuthGate>
    </DataContext.Provider>
  )
}
