/**
 * Live ad approval data: Supabase tables (migrations 0500, 2100), the private
 * "ad-assets" storage bucket, and the ad-check function. Row-level security
 * decides what each person can do; status changes go through set_review_status.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { toCreative, toLeadForm, type ReviewStatus } from '@shared/domain/approvals.ts'
import type {
  ApprovalsApi, AssetFrame, ChecklistRow, ClientBrief, LegacyInfo, ReviewAsset, ReviewDetail, ReviewSummary, Template,
} from './approvals'

const BUCKET = 'ad-assets'
const LINK_SECONDS = 60 * 60

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_').slice(-80) || 'file'

/** Retool kept comments as [{text, datetime, employeeId}] and images as [{imageUrl|canvaLink}]. */
function legacyInfo(legacy: Record<string, unknown> | null, names: Map<string, string>): LegacyInfo | null {
  if (!legacy) return null
  const comments = Array.isArray(legacy.comments) ? legacy.comments as Record<string, unknown>[] : []
  const images = ((legacy.metadata as { adCreative?: { images?: unknown } } | undefined)?.adCreative?.images ?? []) as Record<string, unknown>[]
  const links = new Set<string>()
  for (const i of Array.isArray(images) ? images : []) {
    for (const k of ['imageUrl', 'canvaLink', 'canvaUrl']) if (typeof i?.[k] === 'string' && /^https?:/.test(i[k] as string)) links.add(i[k] as string)
  }
  for (const l of Array.isArray(legacy.canvaLinks) ? legacy.canvaLinks : []) if (typeof l === 'string') links.add(l)
  return {
    comments: comments.map((c) => ({
      text: String(c.text ?? c.comment ?? ''),
      at: typeof c.datetime === 'string' ? c.datetime : null,
      by: typeof c.employeeId === 'string' ? names.get(c.employeeId) ?? null : null,
    })).filter((c) => c.text),
    imageCount: Number(legacy.imageCount ?? 0),
    imageLinks: [...links],
    aiResponse: typeof legacy.aiResponse === 'string' ? legacy.aiResponse : null,
  }
}

export function createSupabaseApprovals(db: SupabaseClient): ApprovalsApi {
  let meId: Promise<string> | null = null
  const me = () => (meId ??= Promise.resolve(db.rpc('me')).then((r) => {
    const id = (r.data as { id?: string } | null)?.id
    if (!id) throw new Error('Not signed in as an MRKD employee.')
    return id
  }))

  let namesCache: Promise<Map<string, string>> | null = null
  const names = () => (namesCache ??= Promise.resolve(db.from('employees').select('id, first_name, last_name')).then((r) =>
    new Map(((r.data ?? []) as { id: string; first_name: string; last_name: string }[]).map((e) => [e.id, `${e.first_name} ${e.last_name}`.trim()]))))

  async function signed(paths: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(paths.filter(Boolean))]
    if (!unique.length) return new Map()
    const { data } = await db.storage.from(BUCKET).createSignedUrls(unique, LINK_SECONDS)
    return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]))
  }

  return {
    async list() {
      const rows = check(await db.rpc('ad_review_list')) as (Omit<ReviewSummary, 'thumbUrl'> & { thumbPath: string | null })[]
      const links = await signed(rows.slice(0, 300).map((r) => r.thumbPath ?? ''))
      return rows.map(({ thumbPath, ...r }) => ({ ...r, thumbUrl: thumbPath ? links.get(thumbPath) ?? null : null }))
    },

    async get(id) {
      const [review, assets, findings, comments, events, items, ticks, runs, who] = await Promise.all([
        db.from('ad_reviews').select('*, client:clients(business_name)').eq('id', id).maybeSingle(),
        db.from('ad_review_assets').select('*').eq('review_id', id).order('position').order('created_at'),
        db.from('ad_review_findings').select('*').eq('review_id', id).order('created_at'),
        db.from('ad_review_comments').select('*').eq('review_id', id).order('created_at'),
        db.from('ad_review_events').select('*').eq('review_id', id).order('created_at'),
        db.from('review_checklist_items').select('*').eq('active', true).order('position'),
        db.from('ad_review_checklist').select('*').eq('review_id', id),
        db.from('ad_review_check_runs').select('status, started_at, finished_at, error').eq('review_id', id).order('started_at', { ascending: false }).limit(1),
        names(),
      ])
      const r = check(review) as Record<string, unknown> & { client: { business_name: string | null } | null } | null
      if (!r) return null
      const nameOf = (x: unknown) => (typeof x === 'string' ? who.get(x) ?? null : null)

      const assetRows = check(assets) as Record<string, unknown>[]
      const links = await signed(assetRows.flatMap((a) => [
        String(a.storage_path ?? ''), ...((a.frames as { path: string }[]) ?? []).map((f) => f.path),
      ]))
      const assetList: ReviewAsset[] = assetRows.map((a) => ({
        id: a.id as string, kind: a.kind as 'image' | 'video', fileName: (a.file_name as string) ?? null,
        mimeType: (a.mime_type as string) ?? null, canvaUrl: (a.canva_url as string) ?? null, position: a.position as number,
        storagePath: (a.storage_path as string) ?? null,
        url: a.storage_path ? links.get(a.storage_path as string) ?? null : null,
        durationSec: a.duration_sec == null ? null : Number(a.duration_sec),
        frames: ((a.frames as { t: number; path: string }[]) ?? []).map((f): AssetFrame => ({ ...f, url: links.get(f.path) ?? null })),
      }))

      const tickMap = new Map((check(ticks) as Record<string, unknown>[]).map((t) => [t.item_key as string, t]))
      const checklist: ChecklistRow[] = (check(items) as Record<string, unknown>[]).map((i) => {
        const t = tickMap.get(i.key as string)
        return {
          key: i.key as string, label: i.label as string, aiCheckable: i.ai_checkable as boolean,
          checked: Boolean(t?.checked), aiResult: (t?.ai_result as ChecklistRow['aiResult']) ?? null, checkedByName: nameOf(t?.checked_by),
        }
      })
      const run = (check(runs) as Record<string, unknown>[])[0]
      const openFindings = (check(findings) as { status: string }[]).filter((f) => f.status === 'open').length

      const detail: ReviewDetail = {
        id: r.id as string, name: r.name as string, clientId: r.client_id as number | null,
        clientName: r.client?.business_name ?? null, status: r.status as ReviewStatus,
        createdBy: r.created_by as string | null, createdByName: nameOf(r.created_by),
        reviewerId: r.reviewer_id as string | null, reviewerName: nameOf(r.reviewer_id),
        adType: r.ad_type as string | null, bookingType: r.booking_type as string | null,
        createdAt: r.created_at as string, updatedAt: r.updated_at as string, submittedAt: r.submitted_at as string | null,
        legacy: r.legacy_id != null, openFindings, thumbUrl: assetList[0]?.frames[0]?.url ?? null,
        creative: toCreative(r.creative), leadform: toLeadForm(r.leadform), notes: (r.notes as string) ?? '',
        metaLeadformId: r.meta_leadform_id as string | null,
        submittedWithOpenFindings: (r.submitted_with_open_findings as number) ?? 0,
        legacyInfo: legacyInfo(r.legacy as Record<string, unknown> | null, who),
        assets: assetList,
        findings: (check(findings) as Record<string, unknown>[]).map((f) => ({
          id: f.id as string, assetId: f.asset_id as string | null, field: f.field as string | null, location: f.location as string | null,
          category: f.category as ReviewDetail['findings'][number]['category'], severity: f.severity as ReviewDetail['findings'][number]['severity'],
          excerpt: f.excerpt as string | null, message: f.message as string, suggestion: f.suggestion as string | null,
          status: f.status as ReviewDetail['findings'][number]['status'], ai: f.check_run_id != null,
        })),
        comments: (check(comments) as Record<string, unknown>[]).map((c) => ({
          id: c.id as string, authorName: nameOf(c.author_id), body: c.body as string, at: c.created_at as string,
        })),
        events: (check(events) as Record<string, unknown>[]).map((e) => ({
          id: String(e.id), actorName: nameOf(e.actor_id), from: e.from_status as ReviewStatus | null, to: e.to_status as ReviewStatus,
          note: e.note as string | null, at: e.created_at as string, acknowledged: ((e.acknowledged_findings as unknown[]) ?? []).length,
        })),
        checklist,
        lastCheck: run ? { status: run.status as 'running' | 'ok' | 'error', at: (run.finished_at ?? run.started_at) as string, error: run.error as string | null } : null,
      }
      return detail
    },

    async create({ clientId, name }) {
      const row = check(await db.from('ad_reviews').insert({
        name: name.trim(), client_id: clientId, created_by: await me(), creative: {}, leadform: {},
      }).select('id').single()) as { id: string }
      return row.id
    },

    async save(id, p) {
      const patch: Record<string, unknown> = {}
      if (p.name !== undefined) patch.name = p.name.trim() || 'Untitled ad'
      if (p.adType !== undefined) patch.ad_type = p.adType || null
      if (p.bookingType !== undefined) patch.booking_type = p.bookingType || null
      if (p.creative !== undefined) patch.creative = p.creative
      if (p.leadform !== undefined) patch.leadform = p.leadform
      if (p.notes !== undefined) patch.notes = p.notes
      if (p.metaLeadformId !== undefined) patch.meta_leadform_id = p.metaLeadformId || null
      if (p.creativeTemplateId !== undefined) patch.creative_template_id = p.creativeTemplateId
      if (p.leadformTemplateId !== undefined) patch.leadform_template_id = p.leadformTemplateId
      const rows = check(await db.from('ad_reviews').update(patch).eq('id', id).select('id')) as unknown[]
      if (!rows.length) throw new Error('Not saved: this ad is read-only.')
    },

    async addFile(id, file, media) {
      const assetId = crypto.randomUUID()
      const base = `${id}/${assetId}`
      const original = `${base}/${safeName(file.name)}`
      check(await db.storage.from(BUCKET).upload(original, file, { contentType: file.type, upsert: false }))
      const frames: { t: number; path: string }[] = []
      for (const [i, f] of media.frames.entries()) {
        const path = `${base}/preview-${i}.jpg`
        check(await db.storage.from(BUCKET).upload(path, f.blob, { contentType: 'image/jpeg', upsert: true }))
        frames.push({ t: f.t, path })
      }
      const { count } = await db.from('ad_review_assets').select('id', { count: 'exact', head: true }).eq('review_id', id)
      check(await db.from('ad_review_assets').insert({
        id: assetId, review_id: id, kind: media.kind, storage_path: original, file_name: file.name, mime_type: file.type,
        width: media.width, height: media.height, duration_sec: media.durationSec, position: count ?? 0,
        created_by: await me(), frames,
      }))
    },

    async addCanvaLink(id, url) {
      const { count } = await db.from('ad_review_assets').select('id', { count: 'exact', head: true }).eq('review_id', id)
      check(await db.from('ad_review_assets').insert({
        review_id: id, kind: 'image', canva_url: url.trim(), position: count ?? 0, created_by: await me(),
      }))
    },

    async removeAsset(asset) {
      check(await db.from('ad_review_assets').delete().eq('id', asset.id))
      // Files live together in "<review id>/<asset id>/": the original and its previews.
      const folder = asset.storagePath?.split('/').slice(0, 2).join('/')
      if (folder) {
        const { data: files } = await db.storage.from(BUCKET).list(folder)
        if (files?.length) await db.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`))
      }
    },

    async move(id, to, opts = {}) {
      check(await db.rpc('set_review_status', {
        p_review: id, p_to: to, p_note: opts.note ?? null, p_reviewer: opts.reviewerId ?? null,
        p_acknowledged: opts.acknowledged?.length ? opts.acknowledged : null,
      }))
    },

    async comment(id, body) {
      check(await db.from('ad_review_comments').insert({ review_id: id, author_id: await me(), body: body.trim() }))
    },

    async tick(id, key, checked) {
      check(await db.from('ad_review_checklist').upsert({
        review_id: id, item_key: key, checked, checked_by: checked ? await me() : null, checked_at: checked ? new Date().toISOString() : null,
      }, { onConflict: 'review_id,item_key' }))
    },

    async setFinding(findingId, status) {
      check(await db.from('ad_review_findings').update({ status }).eq('id', findingId).select('id'))
    },

    async runCheck(id) {
      const { data, error } = await db.functions.invoke('ad-check', { body: { reviewId: id } })
      if (!error) return data as { status: 'ok' | 'unchanged' | 'not_configured' | 'error'; message: string }
      let body: { status?: string; message?: string; error?: string } = {}
      try {
        body = await (error as { context?: Response }).context?.json()
      } catch {
        /* keep default */
      }
      return { status: body.status === 'not_configured' ? 'not_configured' : 'error', message: body.message ?? body.error ?? error.message }
    },

    async clients() {
      const rows = check(await db.from('clients').select('id, business_name, ad_manager_id, active_status, city')
        .in('active_status', ['Active', 'New']).order('business_name')) as { id: number; business_name: string | null; ad_manager_id: string | null; active_status: string | null; city: string | null }[]
      return rows.map((c) => ({ id: c.id, name: c.business_name ?? `Client ${c.id}`, managerId: c.ad_manager_id, status: c.active_status, city: c.city }))
    },

    async brief(clientId) {
      return check(await db.rpc('client_brief', { p_client: clientId })) as ClientBrief | null
    },

    async templates() {
      const [c, l] = await Promise.all([
        db.from('ad_creative_templates').select('id, name, body').order('name'),
        db.from('leadform_templates').select('id, name, body').order('name'),
      ])
      return { creative: check(c) as Template[], leadform: check(l) as Template[] }
    },

    async lookups() {
      const [a, b, c, d] = await Promise.all([
        db.from('ad_types').select('name').order('name'),
        db.from('booking_types').select('name').order('name'),
        db.from('cta_options').select('name').order('name'),
        db.from('app_settings').select('value').eq('key', 'approvals.default_reviewer').maybeSingle(),
      ])
      const names = (x: { name: string }[]) => x.map((r) => r.name)
      const reviewer = (d.data as { value: unknown } | null)?.value
      return {
        adTypes: names(check(a)), bookingTypes: names(check(b)), ctaOptions: names(check(c)),
        defaultReviewerId: typeof reviewer === 'string' ? reviewer : null,
      }
    },
  }
}
