import { useMemo } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { DataContext, type DataSource } from '../data/source'
import { createMockSource } from '../data/mockSource'
import { createSupabaseSource } from '../data/supabaseSource'
import { supabase } from '../lib/supabase'
import { Layout } from './Layout'
import { InsightsPage } from '../features/insights/InsightsPage'
import { SuggestionsPage } from '../features/suggestions/SuggestionsPage'
import { SearchPage } from '../features/search/SearchPage'
import { ApprovalsPage } from '../features/approvals/ApprovalsPage'
import { SyncStatusPage } from '../features/status/SyncStatusPage'

/**
 * Routes (docs/architecture.md):
 *   /insights     Meta insights (Phase 1a)       replaces Retool "Meta Ads Insights"
 *   /suggestions  Suggestions (Phase 1b)         replaces Retool alerts
 *   /approvals    Ad approval (Phase 2)          replaces Retool "Ad Preview"
 *   /search       Lead form & ad copy search      replaces Retool "Search Meta Lead Forms"
 *   /status       Sync health
 * TODO(phase 0): sign-in gate (GHL single sign-on + Google), see docs/auth.md.
 */
export function App() {
  const source: DataSource = useMemo(() => (supabase ? createSupabaseSource(supabase) : createMockSource()), [])
  return (
    <DataContext.Provider value={source}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/insights" replace />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="suggestions" element={<SuggestionsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="status" element={<SyncStatusPage />} />
          <Route path="*" element={<Navigate to="/insights" replace />} />
        </Route>
      </Routes>
    </DataContext.Provider>
  )
}
