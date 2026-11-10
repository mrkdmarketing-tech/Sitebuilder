/**
 * run-rules — refreshes the stored suggestions (docs/suggestions.md).
 * Scheduled 10 minutes after each Meta sync (migration 1700). Uses the SAME
 * rules code as the app (shared/domain/rules.ts).
 *
 *  1. Thresholds from rule_settings (global row; per-client overrides later).
 *  2. Last-7-days report rows + leads in the last 3 days.
 *  3. evaluateRules(...)
 *  4. New problems → new 'open' suggestion, stamped with the client's GHL ads
 *     manager (manager_id) so only they (and owners/admins) see it.
 *     Existing open/snoozed ones → refreshed numbers, last_seen_at bumped.
 *  5. Open/snoozed ones that no longer fire → 'resolved'.
 *  6. Snoozed ones past snoozed_until → 'open' again.
 *  A suggestion dismissed in the last 7 days is not re-created.
 */
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { evaluateRules, type RuleSettings } from '../../../shared/domain/rules.ts'
import { presetRange } from '../../../shared/domain/dates.ts'
import type { ReportRow } from '../../../shared/domain/types.ts'

const DISMISS_DAYS = 7

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const db = serviceClient()
  try {
    const result = await logRun(db, 'rules.run', async () => {
      const range = presetRange('last_7_days')
      const [ads, accounts, recent, settingsRow] = await Promise.all([
        db.rpc('report', { p_level: 'ad', p_from: range.from, p_to: range.to }),
        db.rpc('report', { p_level: 'account', p_from: range.from, p_to: range.to }),
        db.rpc('recent_leads_by_account', { p_days: 3 }),
        db.from('rule_settings').select('params').eq('scope', 'global').maybeSingle(),
      ])
      for (const r of [ads, accounts, recent, settingsRow]) if (r.error) throw new Error(r.error.message)

      const found = evaluateRules({
        ads: (ads.data ?? []) as ReportRow[],
        accounts: (accounts.data ?? []) as ReportRow[],
        recentLeadsByAccount: new Map(((recent.data ?? []) as { account_id: string; leads: number }[]).map((r) => [r.account_id, Number(r.leads)])),
        settings: (settingsRow.data?.params ?? {}) as Partial<RuleSettings>,
      })

      const now = new Date()
      const nowIso = now.toISOString()
      const { data: existing, error: exErr } = await db
        .from('suggestions')
        .select('id, key, status, snoozed_until, updated_at')
        .or(`status.in.(open,snoozed),and(status.eq.dismissed,updated_at.gte.${new Date(now.getTime() - DISMISS_DAYS * 86_400_000).toISOString()})`)
      if (exErr) throw new Error(exErr.message)
      const live = new Map((existing ?? []).filter((s) => s.status !== 'dismissed').map((s) => [s.key as string, s]))
      const dismissed = new Set((existing ?? []).filter((s) => s.status === 'dismissed').map((s) => s.key as string))

      let created = 0, refreshed = 0, resolved = 0, reopened = 0
      const firing = new Set<string>()
      for (const s of found) {
        firing.add(s.key)
        const row = {
          key: s.key, rule: s.rule, severity: s.severity, account_id: s.accountId, client_id: s.clientId,
          manager_id: s.managerId, level: s.level, entity_id: s.entityId, entity_name: s.entityName,
          message: s.message, question: s.question, action: s.action, evidence: s.evidence,
          siblings: s.siblings ?? null, last_seen_at: nowIso,
        }
        const cur = live.get(s.key)
        if (cur) {
          const reopen = cur.status === 'snoozed' && cur.snoozed_until && new Date(cur.snoozed_until as string) <= now
          const { error } = await db.from('suggestions').update({ ...row, ...(reopen ? { status: 'open', snoozed_until: null } : {}) }).eq('id', cur.id)
          if (error) throw new Error(error.message)
          refreshed++
          if (reopen) reopened++
        } else if (!dismissed.has(s.key)) {
          const { error } = await db.from('suggestions').insert({ ...row, status: 'open', first_seen_at: nowIso })
          if (error) throw new Error(error.message)
          created++
        }
      }
      const gone = [...live.values()].filter((s) => !firing.has(s.key as string)).map((s) => s.id)
      if (gone.length) {
        const { error } = await db.from('suggestions').update({ status: 'resolved', resolved_at: nowIso }).in('id', gone)
        if (error) throw new Error(error.message)
        resolved = gone.length
      }
      return { rows: found.length, details: { found: found.length, created, refreshed, resolved, reopened } }
    })
    return json(result)
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500)
  }
})
