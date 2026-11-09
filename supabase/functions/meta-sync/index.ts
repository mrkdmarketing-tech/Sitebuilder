/**
 * meta-sync — pulls Meta ads data into Postgres. Scheduled every 30 min by
 * pg_cron (docs/background-jobs.md). Phase 1a.
 *
 * STATUS: skeleton. The order of steps, logging and the Meta→DB mapping
 * (shared/meta/mapping.ts, unit-tested) are in place; the API calls are
 * written but untested until the Meta System User token exists.
 *
 * Unlike Retool's chained workflows (30–300 min apart), every step runs in one
 * go, each account independently, so one bad account can't stall the rest.
 *
 * Steps per ad account the System User can see:
 *   1. account details        → meta_ad_accounts
 *   2. campaigns              → meta_campaigns
 *   3. ad sets                → meta_adsets
 *   4. creatives (of ads)     → meta_ad_creatives
 *   5. ads                    → meta_ads
 *   6. daily insights, level=ad, last 3 days (+ nightly 37-day backfill) → meta_ad_insights_daily
 *   7. leads (since last sync)→ meta_leads
 * Then: run-rules is triggered to refresh suggestions.
 *
 * Secrets (Supabase → Edge Functions → Secrets): META_SYSTEM_USER_TOKEN, CRON_SECRET.
 */
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import {
  accountStatusLabel,
  bareAccountId,
  mapInsightRow,
  type MetaInsightRow,
} from '../../../shared/meta/mapping.ts'

// Set to Meta's current Graph API version when Phase 1a starts (Retool hard-coded v20.0).
const GRAPH = 'https://graph.facebook.com/v23.0'

async function graph<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const token = Deno.env.get('META_SYSTEM_USER_TOKEN')
  if (!token) throw new Error('META_SYSTEM_USER_TOKEN not set')
  const out: T[] = []
  let url: string | null = `${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token, limit: '500' })}`
  while (url) {
    const res: Response = await fetch(url)
    if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`)
    const body = await res.json()
    out.push(...(body.data ?? []))
    url = body.paging?.next ?? null
  }
  return out
}

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const db = serviceClient()
  const days = Number(new URL(req.url).searchParams.get('days') ?? '3')

  const result = await logRun(db, 'meta.sync', async () => {
    const accounts = await graph<Record<string, unknown>>('me/adaccounts', {
      fields: 'account_id,name,currency,timezone_name,account_status,disable_reason,amount_spent',
    })
    let rows = 0
    const failed: string[] = []

    for (const acc of accounts) {
      const accountId = bareAccountId(String(acc.account_id))
      try {
        await db.from('meta_ad_accounts').upsert({
          account_id: accountId,
          name: acc.name,
          currency: acc.currency,
          timezone_name: acc.timezone_name,
          account_status: accountStatusLabel(acc.account_status as number),
          disable_reason: String(acc.disable_reason ?? ''),
          raw: acc,
          synced_at: new Date().toISOString(),
        })
        // TODO(phase 1a): campaigns, ad sets, creatives, ads (steps 2–5).

        // Step 6: daily ad-level insights for the last `days` days.
        const insights = await graph<MetaInsightRow>(`act_${accountId}/insights`, {
          level: 'ad',
          time_increment: '1',
          date_preset: days > 3 ? 'last_30d' : 'last_3d',
          fields: 'ad_id,adset_id,campaign_id,account_id,spend,impressions,reach,clicks,actions',
        })
        const mapped = insights.map(mapInsightRow)
        if (mapped.length) {
          const { error } = await db.from('meta_ad_insights_daily').upsert(mapped)
          if (error) throw error
        }
        rows += mapped.length
        // TODO(phase 1a): leads (step 7).
      } catch (err) {
        console.error(`account ${accountId}`, err)
        failed.push(accountId)
      }
    }
    return { rows, partial: failed.length > 0, details: { accounts: accounts.length, failed } }
  })

  // TODO(phase 1b): trigger run-rules.
  return json(result)
})
