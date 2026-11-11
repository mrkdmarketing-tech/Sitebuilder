/**
 * Ad approval (docs/ad-approval.md): statuses, the copy an ad carries, template
 * placeholders, and the shape of AI findings. Used by the app and by the
 * ad-check Edge Function, so both agree on field names.
 */

export type ReviewStatus = 'draft' | 'review_pending' | 'request_changes' | 'approved' | 'completed'

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  review_pending: 'Waiting for review',
  request_changes: 'Changes requested',
  approved: 'Approved',
  completed: 'Live',
}

/** Order used to group the list (most urgent first). */
export const STATUS_ORDER: ReviewStatus[] = ['review_pending', 'request_changes', 'draft', 'approved', 'completed']

export interface StatusMove {
  to: ReviewStatus
  label: string
  /** Who normally does it (for the button style and help text only). */
  by: 'submitter' | 'reviewer'
}

/** Allowed moves. The database function set_review_status enforces the same list. */
export const MOVES: Record<ReviewStatus, StatusMove[]> = {
  draft: [{ to: 'review_pending', label: 'Submit for approval', by: 'submitter' }],
  request_changes: [{ to: 'review_pending', label: 'Submit again', by: 'submitter' }],
  review_pending: [
    { to: 'approved', label: 'Approve', by: 'reviewer' },
    { to: 'request_changes', label: 'Request changes', by: 'reviewer' },
  ],
  approved: [
    { to: 'completed', label: 'Mark as live', by: 'submitter' },
    { to: 'request_changes', label: 'Reopen for changes', by: 'reviewer' },
  ],
  completed: [],
}

export function canMove(from: ReviewStatus, to: ReviewStatus): boolean {
  return MOVES[from].some((m) => m.to === to)
}

/** Ad copy (stored in ad_reviews.creative). */
export interface CreativeCopy {
  primaryText: string
  headline: string
  description: string
  callToAction: string
  tracking: string[]
  urlParameters: string
}

/** Lead form (stored in ad_reviews.leadform). */
export interface LeadFormCopy {
  formName: string
  formType: string
  greetingHeadline: string
  greetingDescription: string
  questions: string[]
  privacyPolicyUrl: string
  thankYouHeadline: string
  thankYouDescription: string
  thankYouCallToAction: string
  thankYouUrl: string
}

export const emptyCreative = (): CreativeCopy => ({
  primaryText: '', headline: '', description: '', callToAction: '', tracking: [], urlParameters: '',
})

export const emptyLeadForm = (): LeadFormCopy => ({
  formName: '', formType: '', greetingHeadline: '', greetingDescription: '', questions: [],
  privacyPolicyUrl: '', thankYouHeadline: '', thankYouDescription: '', thankYouCallToAction: '', thankYouUrl: '',
})

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

/** Reads stored JSON (which may be partial or from Retool) into a complete object. */
export function toCreative(raw: unknown): CreativeCopy {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    primaryText: str(r.primaryText), headline: str(r.headline), description: str(r.description ?? r.descriptionAdCreative),
    callToAction: str(r.callToAction), tracking: strs(r.tracking), urlParameters: str(r.urlParameters),
  }
}

/** Retool's lead form names for the thank-you screen ("message for leads"). */
const RETOOL_LEADFORM_ALIASES: Partial<Record<keyof LeadFormCopy, string>> = {
  thankYouHeadline: 'messageForLeadsHeadline',
  thankYouDescription: 'messageForLeadsDescription',
  thankYouCallToAction: 'messageForLeadsCallToAction',
  thankYouUrl: 'messageForLeadsUrl',
}

export function toLeadForm(raw: unknown): LeadFormCopy {
  const r = (raw ?? {}) as Record<string, unknown>
  const e = emptyLeadForm()
  for (const k of Object.keys(e) as (keyof LeadFormCopy)[]) {
    const alias = RETOOL_LEADFORM_ALIASES[k]
    if (k === 'questions') e.questions = strs(r.questions)
    else e[k] = str(r[k] ?? (alias ? r[alias] : undefined))
  }
  return e
}

/**
 * Placeholder values for a client, from client_brief().placeholders, plus the
 * names Retool's templates use ({{ company_name }}, {{ business_address }},
 * {{ contact.city }}...). GHL custom fields come in as their field keys
 * ("contact.privacy_policy").
 */
export function placeholderValues(ph: Record<string, string | null | undefined>): Record<string, string> {
  const v: Record<string, string> = {}
  for (const [k, x] of Object.entries(ph)) if (x != null && x !== '') v[k] = String(x)
  const address = [v.address, v.city, v.state, v.postal_code].filter(Boolean).join(', ')
  const alias: Record<string, string | undefined> = {
    company_name: v.business_name,
    business_name: v.business_name,
    business_address: v.address ? address : undefined,
    full_address: v.address ? address : undefined,
    'contact.company_name': v.business_name,
    'contact.city': v.city,
    'contact.state': v.state,
    'contact.address1': v.address,
    'contact.phone': v.phone,
    'contact.website': v.website,
  }
  for (const [k, x] of Object.entries(alias)) if (x && !v[k]) v[k] = x
  return v
}

/** One piece of text the AI check reads, with a stable field name for findings. */
export interface CheckableText {
  field: string
  label: string
  text: string
}

export const CREATIVE_LABELS: Record<Exclude<keyof CreativeCopy, 'tracking'>, string> = {
  primaryText: 'Primary text', headline: 'Headline', description: 'Description',
  callToAction: 'Call to action', urlParameters: 'URL parameters',
}

export const LEADFORM_LABELS: Record<Exclude<keyof LeadFormCopy, 'questions'>, string> = {
  formName: 'Form name', formType: 'Form type', greetingHeadline: 'Greeting headline',
  greetingDescription: 'Greeting description', privacyPolicyUrl: 'Privacy policy URL',
  thankYouHeadline: 'Thank-you headline', thankYouDescription: 'Thank-you description',
  thankYouCallToAction: 'Thank-you button', thankYouUrl: 'Thank-you link',
}

/** Every non-empty piece of copy, in reading order. Field names match what findings use. */
export function checkableText(creative: CreativeCopy, leadform: LeadFormCopy): CheckableText[] {
  const out: CheckableText[] = []
  for (const [k, label] of Object.entries(CREATIVE_LABELS)) {
    const text = creative[k as keyof typeof CREATIVE_LABELS]
    if (text.trim()) out.push({ field: `creative.${k}`, label, text })
  }
  for (const [k, label] of Object.entries(LEADFORM_LABELS)) {
    const text = leadform[k as keyof typeof LEADFORM_LABELS]
    if (text.trim()) out.push({ field: `leadform.${k}`, label, text })
  }
  leadform.questions.forEach((q, i) => q.trim() && out.push({ field: `leadform.questions.${i}`, label: `Question ${i + 1}`, text: q }))
  return out
}

/** Human label for a finding's field ("creative.headline" -> "Headline"). */
export function fieldLabel(field: string | null): string {
  if (!field) return 'Ad'
  const [group, key, idx] = field.split('.')
  if (group === 'creative') return CREATIVE_LABELS[key as keyof typeof CREATIVE_LABELS] ?? key
  if (group === 'leadform' && key === 'questions') return `Question ${Number(idx) + 1}`
  if (group === 'leadform') return LEADFORM_LABELS[key as keyof typeof LEADFORM_LABELS] ?? key
  if (group === 'asset') return 'Image or video'
  return field
}

/**
 * Fills {{ placeholders }} in template text. Keys are matched without spaces or
 * case ("{{ City }}" and "{{city}}" both use values.city). Unknown placeholders
 * are left as they are so the person can see what still needs filling in.
 */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]))
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (whole, key: string) => {
    const v = lower[key.trim().toLowerCase()]
    return v !== undefined && v !== '' ? v : whole
  })
}

/** Applies fillPlaceholders to every string inside a template body. */
export function fillTemplate<T>(body: T, values: Record<string, string>): T {
  const walk = (v: unknown): unknown =>
    typeof v === 'string' ? fillPlaceholders(v, values)
      : Array.isArray(v) ? v.map(walk)
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
      : v
  return walk(body) as T
}

/** Meta's own URL tags ({{campaign.name}}, {{ad.id}}, {{placement}}...), filled in by Meta, so not a mistake. */
export const isMetaMacro = (name: string) =>
  /^(ad|adset|campaign)\.(name|id)$|^(site_source_name|placement)$/i.test(name.replace(/\s+/g, ''))

/** Placeholders left unfilled ("{{ offer }}"), so the editor can point them out. */
export function unfilledPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1].trim()))].filter((k) => !isMetaMacro(k))
}

// ---------------------------------------------------------------------------
// AI findings
// ---------------------------------------------------------------------------

export type FindingCategory = 'spelling' | 'grammar' | 'logic' | 'mismatch' | 'cta' | 'other'
export type FindingSeverity = 'error' | 'warning' | 'info'
export type FindingStatus = 'open' | 'fixed' | 'ignored'
export type ChecklistAi = 'pass' | 'fail' | 'unsure'

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  spelling: 'Spelling', grammar: 'Grammar', logic: "Doesn't make sense", mismatch: "Doesn't match the client",
  cta: 'Call to action', other: 'Other',
}

/** What the AI returns for one issue (before it's saved). */
export interface RawFinding {
  /** "creative.headline", "leadform.questions.2", or "asset" for image/video text. */
  field: string
  /** For images/videos: which file and where ("image 2", "video 1 at 0:12"). */
  location: string | null
  /** Asset number as given to the AI (1-based), when the issue is in an image or video. */
  assetNumber: number | null
  category: FindingCategory
  severity: FindingSeverity
  excerpt: string
  message: string
  suggestion: string | null
}

export interface RawCheckResult {
  findings: RawFinding[]
  checklist: Record<string, ChecklistAi>
}

const CATEGORIES = new Set<FindingCategory>(['spelling', 'grammar', 'logic', 'mismatch', 'cta', 'other'])
const SEVERITIES = new Set<FindingSeverity>(['error', 'warning', 'info'])
const AI_RESULTS = new Set<ChecklistAi>(['pass', 'fail', 'unsure'])

/**
 * Validates the AI's JSON. Anything malformed is dropped rather than trusted:
 * unknown categories become "other", findings without a message are skipped,
 * and only known checklist keys are kept.
 */
export function parseCheckResult(raw: unknown, checklistKeys: string[]): RawCheckResult {
  const r = (raw ?? {}) as { findings?: unknown; checklist?: unknown }
  const findings: RawFinding[] = []
  for (const f of Array.isArray(r.findings) ? r.findings : []) {
    if (!f || typeof f !== 'object') continue
    const o = f as Record<string, unknown>
    const message = str(o.message).trim()
    if (!message) continue
    const category = CATEGORIES.has(o.category as FindingCategory) ? (o.category as FindingCategory) : 'other'
    const severity = SEVERITIES.has(o.severity as FindingSeverity) ? (o.severity as FindingSeverity) : 'warning'
    const n = Number(o.assetNumber)
    findings.push({
      field: str(o.field).trim() || 'asset',
      location: str(o.location).trim() || null,
      assetNumber: Number.isInteger(n) && n > 0 ? n : null,
      category, severity,
      excerpt: str(o.excerpt).slice(0, 500),
      message: message.slice(0, 1000),
      suggestion: str(o.suggestion).trim().slice(0, 1000) || null,
    })
  }
  const checklist: Record<string, ChecklistAi> = {}
  const c = (r.checklist ?? {}) as Record<string, unknown>
  for (const k of checklistKeys) if (AI_RESULTS.has(c[k] as ChecklistAi)) checklist[k] = c[k] as ChecklistAi
  return { findings, checklist }
}

/**
 * Key used to carry "Ignore" over to the next check run when the same issue is
 * found again (same place, same text, same kind). The message itself is left
 * out because the AI may word it differently each time.
 */
export const findingKey = (f: { field: string | null; excerpt: string | null; category: string }) =>
  `${f.field ?? ''}|${(f.excerpt ?? '').trim().toLowerCase()}|${f.category}`.slice(0, 600)
