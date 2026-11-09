// Wraps a background job so every run is recorded in public.sync_runs
// (powers the sync health page). Usage:
//   await logRun(db, 'meta.insights', async () => ({ rows: 123 }))
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface RunResult {
  rows?: number
  details?: Record<string, unknown>
  /** Some items failed but the job continued. */
  partial?: boolean
}

export async function logRun(
  db: SupabaseClient,
  job: string,
  work: () => Promise<RunResult>,
): Promise<RunResult> {
  const { data: run } = await db.from('sync_runs').insert({ job }).select('id').single()
  try {
    const result = await work()
    await db
      .from('sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: result.partial ? 'partial' : 'ok',
        rows: result.rows ?? null,
        details: result.details ?? {},
      })
      .eq('id', run?.id)
    return result
  } catch (err) {
    await db
      .from('sync_runs')
      .update({ finished_at: new Date().toISOString(), status: 'error', error: String(err) })
      .eq('id', run?.id)
    throw err
  }
}
