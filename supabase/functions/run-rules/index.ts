/**
 * run-rules — refreshes suggestions after each Meta sync (Phase 1b,
 * docs/suggestions.md). Uses the SAME rules code as the app's preview
 * (shared/domain/rules.ts).
 *
 * STATUS: skeleton.
 *   1. Load thresholds (rule_settings: global → ad type → client).
 *   2. Load last-7-days report rows (rpc 'report', level ad + account) and
 *      recent leads (rpc 'recent_leads_by_account').
 *   3. evaluateRules(...)
 *   4. Upsert open suggestions by `key`; bump last_seen_at on existing ones.
 *   5. Mark open suggestions that no longer fire as 'resolved'.
 *   6. Re-open snoozed suggestions whose snoozed_until has passed.
 */
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { evaluateRules } from '../../../shared/domain/rules.ts'
import { presetRange } from '../../../shared/domain/dates.ts'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const db = serviceClient()
  const result = await logRun(db, 'rules.run', async () => {
    const range = presetRange('last_7_days')
    const [{ data: ads }, { data: accounts }, { data: recent }] = await Promise.all([
      db.rpc('report', { p_level: 'ad', p_from: range.from, p_to: range.to }),
      db.rpc('report', { p_level: 'account', p_from: range.from, p_to: range.to }),
      db.rpc('recent_leads_by_account', { p_days: 3 }),
    ])
    const suggestions = evaluateRules({
      ads: ads ?? [],
      accounts: accounts ?? [],
      recentLeadsByAccount: new Map((recent ?? []).map((r: { account_id: string; leads: number }) => [r.account_id, Number(r.leads)])),
      // TODO(phase 1b): settings from rule_settings, with per-client overrides.
    })
    // TODO(phase 1b): steps 4–6 above.
    return { rows: suggestions.length }
  })
  return json(result)
})
