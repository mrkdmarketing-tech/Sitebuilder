/**
 * retool-bridge — copies data still maintained in Retool into Supabase,
 * READ-ONLY, every 15 minutes (docs/retool-bridge.md).
 *
 * The heavy lifting happens inside the database (migration 1100,
 * private.retool_bridge_run): it reads each Retool table over dblink with plain
 * SELECTs and upserts it here. This function just passes in the Retool
 * connection string from its secret and records the run in sync_runs.
 *
 * Secrets: RETOOL_DB_URL (set by Jordan in Supabase), CRON_SECRET.
 * Provided by Supabase: SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import postgres from 'npm:postgres@3'
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const retoolUrl = Deno.env.get('RETOOL_DB_URL')
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!retoolUrl || !dbUrl) return json({ error: 'RETOOL_DB_URL or SUPABASE_DB_URL not set' }, 500)

  const sql = postgres(dbUrl, { max: 1, prepare: false })
  const db = serviceClient()
  try {
    const result = await logRun(db, 'retool_bridge', async () => {
      const [row] = await sql`select private.retool_bridge_run(${retoolUrl}) as result`
      const perTable = row.result as Record<string, number | string>
      const errors = Object.entries(perTable).filter(([, v]) => typeof v === 'string')
      const rows = Object.values(perTable).reduce<number>((n, v) => n + (typeof v === 'number' ? v : 0), 0)
      return { rows, partial: errors.length > 0, details: perTable }
    })
    return json(result)
  } catch (err) {
    // Never echo connection details back.
    const message = String(err).replace(/postgres(ql)?:\/\/[^\s'"]+/g, '[connection string hidden]')
    return json({ error: message }, 500)
  } finally {
    await sql.end()
  }
})
