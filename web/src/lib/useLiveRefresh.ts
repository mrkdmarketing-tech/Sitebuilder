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
    const channel = db
      .channel(`sync-runs-${key}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_runs' }, (payload) => {
        const row = payload.new as { job?: string; status?: string }
        if (row.job && key.split(',').includes(row.job) && row.status && row.status !== 'running') {
          setVersion((v) => v + 1)
        }
      })
      .subscribe()

    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) setVersion((v) => v + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      db.removeChannel(channel)
    }
  }, [key])

  return version
}
