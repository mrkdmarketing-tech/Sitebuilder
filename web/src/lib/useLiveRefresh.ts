import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Returns a number that goes up whenever a background job finishes (Meta sync,
 * suggestions, Retool copy), so screens can reload without the user refreshing.
 * Uses Supabase Realtime on sync_runs (migration 1800). Also refreshes when the
 * tab comes back into view after being hidden for 5+ minutes.
 * In sample mode it never changes.
 */
export function useLiveRefresh(jobs: string[] = ['meta.sync', 'rules.run', 'retool_bridge']): number {
  const [version, setVersion] = useState(0)
  const key = jobs.join(',')

  useEffect(() => {
    if (!supabase) return
    const db = supabase
    // Each screen gets its own channel name: two screens on the same jobs (e.g.
    // the Today badge and the Today page) sharing one name made Supabase throw,
    // which blanked the whole app (11 Nov 2026). Live updates are a nice-to-have,
    // so a failure here is logged and ignored, never allowed to break the page.
    let channel: ReturnType<typeof db.channel> | null = null
    try {
      channel = db
        .channel(`sync-runs-${key}-${Math.random().toString(36).slice(2, 10)}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_runs' }, (payload) => {
          const row = payload.new as { job?: string; status?: string }
          if (row.job && key.split(',').includes(row.job) && row.status && row.status !== 'running') {
            setVersion((v) => v + 1)
          }
        })
        .subscribe()
    } catch (err) {
      console.warn('Live updates unavailable; screens still refresh when you come back to the tab.', err)
    }

    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) setVersion((v) => v + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (channel) void db.removeChannel(channel)
    }
  }, [key])

  return version
}
