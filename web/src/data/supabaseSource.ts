/**
 * Real-data implementation of DataSource, backed by the Supabase database
 * (supabase/migrations). Used automatically when VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are set. Untested against a live project until the
 * Supabase project exists (Phase 0).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Creative, Employee, MetaLead, ReportRow } from '@shared/domain/types.ts'
import type { RuleSettings } from '@shared/domain/rules.ts'
import type { DataSource, LeadFormResult, SyncRun } from './source'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

type CreativeRow = {
  id: string; name: string | null; title: string | null; body: string | null; call_to_action: string | null
  image_url: string | null; thumbnail_url: string | null; video_id: string | null
  video_thumbnail_url: string | null; permalink_url: string | null
}
const toCreative = (c: CreativeRow): Creative => ({
  id: c.id, name: c.name ?? '', title: c.title, body: c.body, callToAction: c.call_to_action,
  imageUrl: c.image_url ?? c.thumbnail_url, videoId: c.video_id, videoThumbnailUrl: c.video_thumbnail_url,
  permalinkUrl: c.permalink_url,
})

export function createSupabaseSource(db: SupabaseClient): DataSource {
  return {
    kind: 'supabase',
    async employees() {
      const rows = check(await db.from('employees').select('id, first_name, last_name, email, is_ad_manager, active').eq('active', true))
      return (rows as { id: string; first_name: string; last_name: string; email: string | null; is_ad_manager: boolean; active: boolean }[]).map(
        (e): Employee => ({ id: e.id, firstName: e.first_name, lastName: e.last_name, email: e.email, isAdManager: e.is_ad_manager, active: e.active }),
      )
    },
    async report(level, range) {
      return check(await db.rpc('report', { p_level: level, p_from: range.from, p_to: range.to })) as ReportRow[]
    },
    async leads(range) {
      return check(await db.rpc('leads_report', { p_from: range.from, p_to: range.to })) as MetaLead[]
    },
    async creative(id) {
      const row = check(await db.from('meta_ad_creatives').select('*').eq('id', id).maybeSingle()) as CreativeRow | null
      return row ? toCreative(row) : null
    },
    async recentLeadsByAccount(days) {
      const rows = check(await db.rpc('recent_leads_by_account', { p_days: days })) as { account_id: string; leads: number }[]
      return new Map(rows.map((r) => [r.account_id, Number(r.leads)]))
    },
    async ruleSettings() {
      const row = check(await db.from('rule_settings').select('params').eq('scope', 'global').maybeSingle()) as { params: Partial<RuleSettings> } | null
      return row?.params ?? {}
    },
    async searchLeadForms(query) {
      const rows = check(await db.rpc('search_lead_forms', { p_query: query })) as {
        id: string; name: string | null; page_id: string | null; questions: { label?: string }[]
        context_card: { title?: string } | null; thank_you_page: { title?: string } | null
      }[]
      return rows.map((f): LeadFormResult => ({
        id: f.id, name: f.name ?? '', pageId: f.page_id,
        questions: (f.questions ?? []).map((q) => q.label ?? ''),
        contextCardTitle: f.context_card?.title ?? null, thankYouTitle: f.thank_you_page?.title ?? null,
      }))
    },
    async searchAdCopy(query) {
      return (check(await db.rpc('search_ad_copy', { p_query: query })) as CreativeRow[]).map(toCreative)
    },
    async syncRuns() {
      const rows = check(await db.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(50)) as {
        job: string; started_at: string; finished_at: string | null; status: SyncRun['status']; rows: number | null; error: string | null
      }[]
      return rows.map((r) => ({ job: r.job, startedAt: r.started_at, finishedAt: r.finished_at, status: r.status, rows: r.rows, error: r.error }))
    },
    async lastUpdated() {
      const row = check(
        await db.from('sync_runs').select('finished_at').eq('job', 'meta.sync').in('status', ['ok', 'partial'])
          .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
      ) as { finished_at: string } | null
      return row?.finished_at ?? null
    },
  }
}
