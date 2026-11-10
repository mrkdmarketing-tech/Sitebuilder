/**
 * Sample-mode ad approval: kept in memory (gone on reload), nothing uploaded.
 * The "AI check" here is a tiny stand-in that spots repeated words, double
 * spaces and a few common misspellings, so the screens can be tried without
 * the real check (supabase/functions/ad-check).
 */
import {
  MOVES, checkableText, emptyCreative, emptyLeadForm, findingKey, type ReviewStatus,
} from '@shared/domain/approvals.ts'
import type { Employee } from '@shared/domain/types.ts'
import type { ApprovalsApi, ReviewDetail, ReviewFinding, Template } from './approvals'
import type { MockClient } from './mock/generate'

const CHECKLIST: [string, string, boolean][] = [
  ['logo', 'Correct logo', true], ['address_phone', 'Address and phone number correct (check small print)', true],
  ['spelling', 'All spelling on the image is correct', true], ['cta_headline', 'Image CTA matches the headline', true],
  ['cta_primary', 'Image CTA matches the primary copy', true], ['alignment', 'Image is aligned properly', false],
  ['city', 'City matches the primary copy', true], ['tracking', 'Tracking events are on (if available)', false],
  ['naming', 'Campaign naming is correct', false], ['leadforms', 'Lead forms are connected and correct', false],
  ['new_leadform', 'Trent informed of any new campaign lead forms', false],
]

const MISSPELLED: Record<string, string> = {
  'jiu jitsue': 'jiu jitsu', recieve: 'receive', seperate: 'separate', definately: 'definitely',
  begginer: 'beginner', begginers: 'beginners', excercise: 'exercise', freind: 'friend', schedual: 'schedule',
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

export function createMockApprovals(opts: { employees: Employee[]; clients: MockClient[]; meId: () => Promise<string> }): ApprovalsApi {
  const name = (id: string | null) => {
    const e = opts.employees.find((x) => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : null
  }
  const clientName = (id: number | null) => opts.clients.find((c) => c.id === id)?.name ?? null
  const live = opts.clients.filter((c) => c.status === 'Active' || c.status === 'New')
  const reviews = new Map<string, ReviewDetail>()

  const blank = (id: string, clientId: number, title: string, by: string, status: ReviewStatus): ReviewDetail => ({
    id, name: title, clientId, clientName: clientName(clientId), status, createdBy: by, createdByName: name(by),
    reviewerId: null, reviewerName: null, adType: null, bookingType: null, createdAt: now(), updatedAt: now(),
    submittedAt: null, legacy: false, openFindings: 0, thumbUrl: null, creative: emptyCreative(), leadform: emptyLeadForm(),
    notes: '', metaLeadformId: null, submittedWithOpenFindings: 0, legacyInfo: null, assets: [], findings: [], comments: [],
    events: [], checklist: CHECKLIST.map(([key, label, aiCheckable]) => ({ key, label, aiCheckable, checked: false, aiResult: null, checkedByName: null })),
    lastCheck: null,
  })

  // Two examples so the list isn't empty.
  if (live[0]) {
    const a = blank('sample-1', live[0].id, 'Kids program fall offer', 'emp_alex', 'review_pending')
    a.creative = { ...emptyCreative(), headline: 'Free week of kids jiu jitsue', primaryText: `Parents in ${live[0].city}: give your kids confidence on and off the mat. Book a free week today.`, callToAction: 'Book now' }
    a.reviewerId = live[0].managerId
    a.reviewerName = name(live[0].managerId)
    a.submittedAt = now()
    reviews.set(a.id, a)
  }
  if (live[1]) reviews.set('sample-2', blank('sample-2', live[1].id, 'Adult beginners, video', 'emp_sam', 'draft'))

  const get = (id: string) => {
    const r = reviews.get(id)
    if (!r) throw new Error('Ad not found.')
    return r
  }
  const touch = (r: ReviewDetail) => {
    r.updatedAt = now()
    r.openFindings = r.findings.filter((f) => f.status === 'open').length
  }

  return {
    async list() {
      await wait(60)
      return [...reviews.values()].map(({ creative: _c, leadform: _l, assets: _a, findings: _f, comments: _co, events: _e, checklist: _ch, ...s }) => ({
        ...s, thumbUrl: reviews.get(s.id)!.assets[0]?.frames[0]?.url ?? null,
      })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async get(id) {
      await wait(60)
      const r = reviews.get(id)
      return r ? structuredClone(r) : null
    },
    async create({ clientId, name: title }) {
      const id = `sample-${crypto.randomUUID().slice(0, 8)}`
      reviews.set(id, blank(id, clientId, title.trim(), await opts.meId(), 'draft'))
      return id
    },
    async save(id, p) {
      const r = get(id)
      if (p.name !== undefined) r.name = p.name.trim() || 'Untitled ad'
      if (p.adType !== undefined) r.adType = p.adType
      if (p.bookingType !== undefined) r.bookingType = p.bookingType
      if (p.creative) r.creative = structuredClone(p.creative)
      if (p.leadform) r.leadform = structuredClone(p.leadform)
      if (p.notes !== undefined) r.notes = p.notes
      if (p.metaLeadformId !== undefined) r.metaLeadformId = p.metaLeadformId
      touch(r)
    },
    async addFile(id, file, media) {
      const r = get(id)
      r.assets.push({
        id: crypto.randomUUID(), kind: media.kind, fileName: file.name, mimeType: file.type, canvaUrl: null,
        position: r.assets.length, storagePath: null, url: URL.createObjectURL(file), durationSec: media.durationSec,
        frames: media.frames.map((f, i) => ({ t: f.t, path: `frame-${i}`, url: URL.createObjectURL(f.blob) })),
      })
      touch(r)
    },
    async addCanvaLink(id, url) {
      const r = get(id)
      r.assets.push({ id: crypto.randomUUID(), kind: 'image', fileName: null, mimeType: null, canvaUrl: url, position: r.assets.length, storagePath: null, url: null, durationSec: null, frames: [] })
      touch(r)
    },
    async removeAsset(asset) {
      for (const r of reviews.values()) r.assets = r.assets.filter((a) => a.id !== asset.id)
    },
    async move(id, to, o = {}) {
      const r = get(id)
      if (!MOVES[r.status].some((m) => m.to === to)) throw new Error(`An ad that is ${r.status} cannot move to ${to}.`)
      const me = await opts.meId()
      r.events.push({ id: crypto.randomUUID(), actorName: name(me), from: r.status, to, note: o.note ?? null, at: now(), acknowledged: o.acknowledged?.length ?? 0 })
      if (o.note?.trim()) r.comments.push({ id: crypto.randomUUID(), authorName: name(me), body: o.note.trim(), at: now() })
      if (to === 'review_pending') {
        r.submittedAt = now()
        r.submittedWithOpenFindings = r.findings.filter((f) => f.status === 'open').length
        r.reviewerId = o.reviewerId ?? r.reviewerId ?? opts.clients.find((c) => c.id === r.clientId)?.managerId ?? null
        r.reviewerName = name(r.reviewerId)
      }
      r.status = to
      touch(r)
    },
    async comment(id, body) {
      get(id).comments.push({ id: crypto.randomUUID(), authorName: name(await opts.meId()), body: body.trim(), at: now() })
    },
    async tick(id, key, checked) {
      const me = await opts.meId()
      const row = get(id).checklist.find((c) => c.key === key)
      if (row) Object.assign(row, { checked, checkedByName: checked ? name(me) : null })
    },
    async setFinding(findingId, status) {
      for (const r of reviews.values()) {
        const f = r.findings.find((x) => x.id === findingId)
        if (f) { f.status = status; touch(r) }
      }
    },
    async runCheck(id) {
      await wait(700)
      const r = get(id)
      const ignored = new Set(r.findings.filter((f) => f.status === 'ignored').map(findingKey))
      const found: ReviewFinding[] = []
      for (const t of checkableText(r.creative, r.leadform)) {
        const add = (category: ReviewFinding['category'], excerpt: string, message: string, suggestion: string | null) => {
          const f: ReviewFinding = { id: crypto.randomUUID(), assetId: null, field: t.field, location: null, category, severity: 'warning', excerpt, message, suggestion, status: 'open' }
          if (ignored.has(findingKey(f))) f.status = 'ignored'
          found.push(f)
        }
        for (const [bad, good] of Object.entries(MISSPELLED)) {
          const m = t.text.match(new RegExp(`\\b${bad}\\b`, 'i'))
          if (m) add('spelling', m[0], `"${m[0]}" looks misspelled.`, good)
        }
        const rep = t.text.match(/\b(\w+)\s+\1\b/i)
        if (rep) add('grammar', rep[0], `"${rep[1]}" is repeated.`, rep[1])
        if (/ {2,}/.test(t.text)) add('grammar', '  ', 'Double space.', ' ')
      }
      r.findings = found
      r.lastCheck = { status: 'ok', at: now(), error: null }
      touch(r)
      return { status: 'ok', message: found.length ? `Sample check: ${found.length} possible issue${found.length === 1 ? '' : 's'}. (The real AI check runs on the live app.)` : 'Sample check: nothing spotted. (The real AI check runs on the live app.)' }
    },
    async clients() {
      return live.map((c) => ({ id: c.id, name: c.name, managerId: c.managerId, status: c.status }))
    },
    async brief(clientId) {
      const c = opts.clients.find((x) => x.id === clientId)
      if (!c) return null
      return {
        clientId, businessName: c.name, adsManager: name(c.managerId), adsManagerId: c.managerId,
        placeholders: { business_name: c.name, city: c.city, phone: '(555) 010-2030', offer: 'Free first week', address: '12 Sample St' },
        facts: [{ label: 'Business Phone', value: '(555) 010-2030' }, { label: 'City', value: c.city }],
        onboarding: { 'Introductory offer': 'Free first week', Programs: 'Kids, Adults, Competition' },
        campaign: { 'Call to action': 'Book now', 'Monthly budget': 900 },
      }
    },
    async templates() {
      const creative: Template[] = [{ id: 't1', name: 'Free week (sample)', body: { headline: 'A free week in {{ city }}', primaryText: '{{ business_name }} is offering {{ offer }}. Call {{ phone }}.', callToAction: 'Book now' } }]
      const leadform: Template[] = [{ id: 'l1', name: 'Basic form (sample)', body: { formName: 'Free week', formType: 'Higher intent', questions: ['Full name', 'Phone number', 'Are you in {{ city }}?'], greetingHeadline: 'Claim your free week' } }]
      return { creative, leadform }
    },
    async lookups() {
      return {
        adTypes: ['jiu jitsu beginners program', 'jiu jitsu kids program', 'kickboxing', 'yoga studio'],
        bookingTypes: ['Booking Link', 'Landing Page', 'No Link'],
        ctaOptions: ['Book now', 'Learn more', 'Sign up', 'Get offer'],
      }
    },
  }
}
