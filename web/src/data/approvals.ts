/**
 * Ad approval data (docs/ad-approval.md). Part of DataSource as `ds.approvals`.
 * Live: approvalsSupabase.ts (tables and functions from migrations 0500 and 2100,
 * files in the private "ad-assets" bucket). Sample mode: approvalsMock.ts.
 */
import type {
  ChecklistAi, CreativeCopy, FindingCategory, FindingSeverity, FindingStatus, LeadFormCopy, ReviewStatus,
} from '@shared/domain/approvals.ts'

export interface ReviewSummary {
  id: string
  name: string
  clientId: number | null
  clientName: string | null
  status: ReviewStatus
  createdBy: string | null
  createdByName: string | null
  reviewerId: string | null
  reviewerName: string | null
  adType: string | null
  bookingType: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  /** Imported from Retool's Ad Preview: read-only. */
  legacy: boolean
  openFindings: number
  thumbUrl: string | null
}

export interface AssetFrame {
  /** Seconds into a video (0 for images). */
  t: number
  path: string
  url: string | null
}

export interface ReviewAsset {
  id: string
  kind: 'image' | 'video'
  fileName: string | null
  mimeType: string | null
  canvaUrl: string | null
  position: number
  /** Where the original file is stored ("<review id>/<asset id>/<file>"). */
  storagePath: string | null
  /** Short-lived link to the original file. */
  url: string | null
  frames: AssetFrame[]
  durationSec: number | null
}

export interface ReviewFinding {
  id: string
  assetId: string | null
  field: string | null
  location: string | null
  category: FindingCategory
  severity: FindingSeverity
  excerpt: string | null
  message: string
  suggestion: string | null
  status: FindingStatus
}

export interface ReviewComment {
  id: string
  authorName: string | null
  body: string
  at: string
}

export interface ReviewEvent {
  id: string
  actorName: string | null
  from: ReviewStatus | null
  to: ReviewStatus
  note: string | null
  at: string
  acknowledged: number
}

export interface ChecklistRow {
  key: string
  label: string
  aiCheckable: boolean
  checked: boolean
  aiResult: ChecklistAi | null
  checkedByName: string | null
}

/** What was kept from Retool for imported ads. */
export interface LegacyInfo {
  comments: { text: string; at: string | null; by: string | null }[]
  imageCount: number
  imageLinks: string[]
  aiResponse: string | null
}

export interface CheckRunInfo {
  status: 'running' | 'ok' | 'error'
  at: string
  error: string | null
}

export interface ReviewDetail extends ReviewSummary {
  creative: CreativeCopy
  leadform: LeadFormCopy
  notes: string
  metaLeadformId: string | null
  submittedWithOpenFindings: number
  legacyInfo: LegacyInfo | null
  assets: ReviewAsset[]
  findings: ReviewFinding[]
  comments: ReviewComment[]
  events: ReviewEvent[]
  checklist: ChecklistRow[]
  lastCheck: CheckRunInfo | null
}

export interface ReviewPatch {
  name?: string
  adType?: string | null
  bookingType?: string | null
  creative?: CreativeCopy
  leadform?: LeadFormCopy
  notes?: string
  metaLeadformId?: string | null
  creativeTemplateId?: string | null
  leadformTemplateId?: string | null
}

export interface ClientOption {
  id: number
  name: string
  managerId: string | null
  status: string | null
}

export interface ClientBrief {
  clientId: number
  businessName: string | null
  adsManager: string | null
  adsManagerId: string | null
  placeholders: Record<string, string>
  facts: { label: string; value: string }[]
  onboarding: Record<string, unknown> | null
  campaign: Record<string, unknown> | null
}

export interface Template {
  id: string
  name: string
  body: Record<string, unknown>
}

/** Images and video frames turned into small JPEGs in the browser (web/src/lib/media.ts). */
export interface PreparedMedia {
  kind: 'image' | 'video'
  width: number | null
  height: number | null
  durationSec: number | null
  frames: { t: number; blob: Blob }[]
  /** Set when the browser couldn't read the file (e.g. an unusual video format). */
  warning: string | null
}

export interface CheckResult {
  status: 'ok' | 'unchanged' | 'not_configured' | 'error'
  message: string
}

export interface MoveOptions {
  note?: string
  reviewerId?: string | null
  /** Open findings shown in "Hey, just double checking". */
  acknowledged?: string[]
}

export interface ApprovalsApi {
  list(): Promise<ReviewSummary[]>
  get(id: string): Promise<ReviewDetail | null>
  create(input: { clientId: number; name: string }): Promise<string>
  save(id: string, patch: ReviewPatch): Promise<void>
  addFile(id: string, file: File, media: PreparedMedia): Promise<void>
  addCanvaLink(id: string, url: string): Promise<void>
  removeAsset(asset: ReviewAsset): Promise<void>
  move(id: string, to: ReviewStatus, opts?: MoveOptions): Promise<void>
  comment(id: string, body: string): Promise<void>
  tick(id: string, key: string, checked: boolean): Promise<void>
  setFinding(findingId: string, status: FindingStatus): Promise<void>
  /** Runs the AI mistake check (ad-check function). */
  runCheck(id: string): Promise<CheckResult>
  clients(): Promise<ClientOption[]>
  brief(clientId: number): Promise<ClientBrief | null>
  templates(): Promise<{ creative: Template[]; leadform: Template[] }>
  lookups(): Promise<{ adTypes: string[]; bookingTypes: string[]; ctaOptions: string[] }>
}
