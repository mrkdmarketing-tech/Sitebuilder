/**
 * meta-sync — pulls Meta ads data into Postgres (Phase 1a, docs/background-jobs.md).
 *
 * Schedule (migration 1300): every 30 min with ?days=3 (Meta revises recent
 * days), nightly with ?days=37 (backfill for month-over-month comparisons).
 *
 * Which accounts: every ad account the MRKDPlatformTools system user can see is
 * refreshed (name, status, currency). The detailed sync (campaigns, ad sets,
 * ads, creatives, daily insights) runs for accounts linked to an Active or New
 * client, which is what the dashboard shows. Accounts run 4 at a time, each
 * independently: one failing account doesn't stop the others.
 *
 * The token is sent in the Authorization header, never in URLs we build, and
 * stripped from Meta's own paging URLs, so it can't leak into logs or errors.
 *
 * Secrets: META_SYSTEM_USER_TOKEN, CRON_SECRET.
 */
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import {
  accountStatusLabel,
  bareAccountId,
  budgetFromMinor,
  gendersLabel,
  isAdvantagePlus,
  mapInsightRow,
  type MetaInsightRow,
} from '../../../shared/meta/mapping.ts'

// Meta Graph API version. Retool hard-coded v20.0. Bump deliberately.
const GRAPH = 'https://graph.facebook.com/v23.0'
const CONCURRENCY = 4
const LIVE_EFFECTIVE = [
  'ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES',
  'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO',
]

type Row = Record<string, unknown>
const token = () => {
  const t = Deno.env.get('META_SYSTEM_USER_TOKEN')
  if (!t) throw new Error('META_SYSTEM_USER_TOKEN not set')
  return t
}

/** GET every page of a Graph API edge. Throws a short message without URLs. */
async function graph<T = Row>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = []
  let limit = 500
  let url: string | null = `${GRAPH}/${path}?${new URLSearchParams({ limit: String(limit), ...params })}`
  let pages = 0
  let retries = 0
  while (url && pages++ < 400) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const e = body?.error ?? {}
      // "Please reduce the amount of data you're asking for": retry this page
      // with a smaller batch (500 → 250 → … → 25) instead of failing the account.
      if (e.code === 1 && /reduce the amount of data/i.test(e.message ?? '') && limit > 25) {
        limit = Math.max(25, Math.floor(limit / 2))
        const u = new URL(url)
        u.searchParams.set('limit', String(limit))
        url = u.toString()
        continue
      }
      // Meta's temporary errors ("Service temporarily unavailable", code 2;
      // "An unknown error occurred", code 1/99; bare 5xx): wait and retry the
      // same page up to 3 times before failing the account.
      const transient = e.code === 2 || (e.code === 1 && e.error_subcode === 99) || (res.status >= 500 && !e.code) || e.is_transient === true
      if (transient && retries < 3) {
        retries++
        pages--
        await new Promise((r) => setTimeout(r, 2000 * retries))
        continue
      }
      throw new Error(`Meta ${res.status} on ${path.split('?')[0]}: ${e.message ?? 'unknown error'} (code ${e.code ?? '?'}${e.error_subcode ? '/' + e.error_subcode : ''})`)
    }
    retries = 0
    out.push(...(body.data ?? []))
    const next: string | undefined = body.paging?.next
    if (next) {
      const u = new URL(next)
      u.searchParams.delete('access_token')
      url = u.toString()
    } else url = null
  }
  return out
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function upsert(db: ReturnType<typeof serviceClient>, table: string, rows: Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
  for (const part of chunk(rows, 500)) {
    const { error } = await db.from(table).upsert(part, opts)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift()!)
  }))
}

/** Inserts placeholder campaigns/ad sets (status ARCHIVED) for any referenced but not fetched. */
async function ensureParents(
  db: ReturnType<typeof serviceClient>, accountId: string, now: string, campaigns: Row[], adsets: Row[],
  refs: { campaign_id: string; adset_id: string; campaign_name?: string; adset_name?: string }[],
) {
  const haveC = new Set(campaigns.map((r) => r.id as string)), haveS = new Set(adsets.map((r) => r.id as string))
  const extraC = new Map<string, Row>(), extraS = new Map<string, Row>()
  for (const r of refs) {
    if (r.campaign_id && !haveC.has(r.campaign_id)) extraC.set(r.campaign_id, { id: r.campaign_id, account_id: accountId, name: r.campaign_name ?? null, status: 'ARCHIVED', synced_at: now })
    if (r.adset_id && !haveS.has(r.adset_id)) extraS.set(r.adset_id, { id: r.adset_id, campaign_id: r.campaign_id, account_id: accountId, name: r.adset_name ?? null, status: 'ARCHIVED', synced_at: now })
  }
  await upsert(db, 'meta_campaigns', [...extraC.values()], { ignoreDuplicates: true })
  await upsert(db, 'meta_adsets', [...extraS.values()], { ignoreDuplicates: true })
}

function torontoDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Splits an inclusive YYYY-MM-DD range into windows of at most 7 days. */
function weekWindows(since: string, until: string): { since: string; until: string }[] {
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`)
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  const out: { since: string; until: string }[] = []
  for (let t = day(since); t <= day(until); t += 7 * 86_400_000) {
    out.push({ since: iso(t), until: iso(Math.min(t + 6 * 86_400_000, day(until))) })
  }
  return out
}

async function syncAccount(db: ReturnType<typeof serviceClient>, accountId: string, days: number) {
  const act = `act_${accountId}`
  const now = new Date().toISOString()
  const live = JSON.stringify([{ field: 'effective_status', operator: 'IN', value: LIVE_EFFECTIVE }])

  // Campaigns
  const campaigns = await graph(`${act}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,buying_type,bid_strategy,pacing_type',
    filtering: live,
  })
  await upsert(db, 'meta_campaigns', campaigns.map((c) => ({
    id: c.id, account_id: accountId, name: c.name, status: c.status, effective_status: c.effective_status,
    objective: c.objective, daily_budget: budgetFromMinor(c.daily_budget as string), lifetime_budget: budgetFromMinor(c.lifetime_budget as string),
    buying_type: c.buying_type, bid_strategy: c.bid_strategy,
    pacing_type: Array.isArray(c.pacing_type) ? (c.pacing_type as string[]).join(',') : (c.pacing_type ?? null),
    raw: c, synced_at: now,
  })))

  // Ad sets
  const adsets = await graph(`${act}/adsets`, {
    fields: 'id,name,campaign_id,status,effective_status,optimization_goal,daily_budget,targeting,learning_stage_info',
    filtering: live,
  })
  await upsert(db, 'meta_adsets', adsets.map((s) => {
    const t = (s.targeting ?? {}) as Row
    return {
      id: s.id, campaign_id: s.campaign_id, account_id: accountId, name: s.name, status: s.status,
      effective_status: s.effective_status, optimization_goal: s.optimization_goal,
      daily_budget: budgetFromMinor(s.daily_budget as string), advantage_plus: isAdvantagePlus(t),
      learning_stage: ((s.learning_stage_info ?? {}) as Row).status ?? null,
      age_min: t.age_min ?? null, age_max: t.age_max ?? null, genders: gendersLabel(t.genders as number[]),
      targeting: t, raw: { ...s, targeting: undefined }, synced_at: now,
    }
  }))

  // Ads + their creatives
  const ads = await graph(`${act}/ads`, {
    fields: 'id,name,adset_id,campaign_id,status,effective_status,creative{id,name,title,body,call_to_action_type,image_url,thumbnail_url,video_id,effective_object_story_id}',
    filtering: live,
    thumbnail_width: '400',
    thumbnail_height: '400',
  })
  // Several ads often share one creative: keep each creative once.
  const creatives = [...new Map(
    ads.map((a) => a.creative as Row | undefined).filter((c): c is Row => !!c?.id).map((c) => [c.id as string, c]),
  ).values()]
  await upsert(db, 'meta_ad_creatives', creatives.map((c) => ({
    id: c.id, account_id: accountId, name: c.name ?? null, title: c.title ?? null, body: c.body ?? null,
    call_to_action: c.call_to_action_type ?? null, image_url: c.image_url ?? null, thumbnail_url: c.thumbnail_url ?? null,
    video_id: c.video_id ?? null,
    permalink_url: c.effective_object_story_id ? `https://www.facebook.com/${c.effective_object_story_id}` : null,
    raw: c, synced_at: now,
  })))
  // An ad can be live while its ad set or campaign is archived (so it wasn't
  // in the lists above). Add minimal parent rows first so nothing is dropped.
  await ensureParents(db, accountId, now, campaigns, adsets, ads.map((a) => ({
    campaign_id: a.campaign_id as string, adset_id: a.adset_id as string,
  })))
  await upsert(db, 'meta_ads', ads.map((a) => ({
    id: a.id, adset_id: a.adset_id, campaign_id: a.campaign_id, account_id: accountId, name: a.name,
    status: a.status, effective_status: a.effective_status, creative_id: (a.creative as Row | undefined)?.id ?? null,
    raw: { ...a, creative: undefined }, synced_at: now,
  })))

  // Daily ad-level insights, asked for one week at a time: big accounts (e.g.
  // 750+ ads) make Meta fail with "unknown error" on a 37-day request.
  type InsightRow = MetaInsightRow & { ad_name?: string; adset_name?: string; campaign_name?: string }
  const insights: InsightRow[] = []
  for (const w of weekWindows(torontoDate(-days), torontoDate(0))) {
    insights.push(...await graph<InsightRow>(`${act}/insights`, {
      level: 'ad',
      time_increment: '1',
      time_range: JSON.stringify(w),
      fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,account_id,spend,impressions,reach,clicks,actions',
    }))
  }
  if (insights.length) {
    // Ads that spent in the window but are now deleted/archived weren't in the
    // lists above: add minimal rows (and parents) so the daily numbers are kept.
    await ensureParents(db, accountId, now, campaigns, adsets, insights.map((i) => ({
      campaign_id: i.campaign_id, campaign_name: i.campaign_name, adset_id: i.adset_id, adset_name: i.adset_name,
    })))
    const haveA = new Set(ads.map((r) => r.id as string))
    const extraA = new Map<string, Row>()
    for (const i of insights) {
      if (!haveA.has(i.ad_id)) extraA.set(i.ad_id, { id: i.ad_id, adset_id: i.adset_id, campaign_id: i.campaign_id, account_id: accountId, name: i.ad_name, status: 'ARCHIVED', synced_at: now })
    }
    await upsert(db, 'meta_ads', [...extraA.values()], { ignoreDuplicates: true })
    // One row per ad per day (Meta can repeat a row across pages).
    const daily = new Map<string, Row>()
    for (const i of insights) {
      const r = { ...mapInsightRow({ ...i, account_id: accountId }), synced_at: now }
      daily.set(`${r.ad_id}|${r.date}`, r)
    }
    await upsert(db, 'meta_ad_insights_daily', [...daily.values()])
  }
  return { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length, insightRows: insights.length }
}

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const db = serviceClient()
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days') ?? '3') || 3, 1), 90)

  try {
    const result = await logRun(db, 'meta.sync', async () => {
      // 1. Every account the system user can see: refresh name/status/currency.
      const accounts = await graph('me/adaccounts', {
        fields: 'account_id,name,currency,timezone_name,account_status,disable_reason,amount_spent',
      })
      const now = new Date().toISOString()
      await upsert(db, 'meta_ad_accounts', accounts.map((a) => ({
        account_id: bareAccountId(String(a.account_id)), name: a.name, currency: a.currency, timezone_name: a.timezone_name,
        account_status: accountStatusLabel(a.account_status as number), disable_reason: String(a.disable_reason ?? ''),
        amount_spent: a.amount_spent === undefined ? null : Number(a.amount_spent) / 100, raw: a, synced_at: now,
      })))
      // (client_id is not touched here: it comes from the Retool bridge.)

      // 2. Detailed sync for accounts linked to Active/New clients.
      const visible = new Set(accounts.map((a) => bareAccountId(String(a.account_id))))
      const { data: linked, error } = await db
        .from('meta_ad_accounts')
        .select('account_id, clients!inner(active_status)')
        .in('clients.active_status', ['Active', 'New'])
      if (error) throw new Error(`linked accounts: ${error.message}`)
      const targets = (linked ?? []).map((r) => r.account_id as string).filter((id) => visible.has(id))
      const notVisible = (linked ?? []).map((r) => r.account_id as string).filter((id) => !visible.has(id))

      const failed: Record<string, string> = {}
      const counts = { campaigns: 0, adsets: 0, ads: 0, insightRows: 0 }
      await pool(targets, CONCURRENCY, async (id) => {
        try {
          const c = await syncAccount(db, id, days)
          for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] += c[k]
        } catch (err) {
          failed[id] = String(err instanceof Error ? err.message : err).slice(0, 300)
        }
      })
      return {
        rows: counts.insightRows,
        partial: Object.keys(failed).length > 0,
        details: { days, accountsVisible: accounts.length, accountsSynced: targets.length - Object.keys(failed).length, ...counts, failed, notVisibleToSystemUser: notVisible },
      }
    })
    return json(result)
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500)
  }
})
