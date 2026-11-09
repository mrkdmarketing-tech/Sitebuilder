/**
 * Core types shared by the web app and the Supabase background jobs.
 *
 * Keep this file free of imports from React, Supabase or Node so it can run
 * anywhere (browser, Deno edge functions, Vitest). See docs/architecture.md.
 */

export type Level = 'account' | 'campaign' | 'adset' | 'ad'

/** Raw, additive totals for an entity over a date range. Derived metrics
 * (CPL, CPM, …) are never stored; they are computed from these by metrics.ts. */
export interface Totals {
  spend: number
  impressions: number
  /** Sum of daily reach. Not de-duplicated across days; same as Retool. See docs/metrics.md. */
  reach: number
  clicks: number
  linkClicks: number
  /** Meta "lead" action count. */
  leads: number
  comments: number
  pageLikes: number
  /** Meta "messaging conversation started (7d)" action count. */
  messages: number
  /** Lead outcomes from the clients' lead sheets (via the Retool bridge). */
  booked: number
  shown: number
  closed: number
  closedValue: number
  /** Total value generated (upfront + months × membership). Account level only. */
  valueGenerated: number
}

/** Meta's delivery status, simplified. An entity is "ACTIVE" only if it and
 * every parent (ad set, campaign, account) are active, matching Retool. */
export type DeliveryStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED' | 'DISABLED' | 'OTHER'

export interface ReportRow extends Totals {
  level: Level
  id: string
  name: string
  status: DeliveryStatus
  /** Meta's raw status label, e.g. "ACTIVE", "UNSETTLED", "CAMPAIGN_PAUSED". */
  statusLabel: string

  accountId: string
  accountName: string
  /** Ad account counts toward "Active Acc." (ACTIVE, IN_GRACE_PERIOD, UNSETTLED). */
  accountActive: boolean
  currency: string
  campaignId?: string
  campaignName?: string
  adsetId?: string
  adsetName?: string

  clientId: number | null
  clientName: string | null
  /** Client status from GHL: New | Active | Inactive | Paused. */
  clientStatus: string | null
  managerId: string | null
  managerName: string | null
  leadsSheetUrl?: string | null

  // Campaign-level settings
  dailyBudget?: number | null
  objective?: string | null
  buyingType?: string | null
  bidStrategy?: string | null
  pacingType?: string | null

  // Ad set-level settings
  optimizationGoal?: string | null
  advantagePlus?: boolean | null
  learningStage?: string | null
  ageMin?: number | null
  ageMax?: number | null
  genders?: string | null

  // Ad-level
  creativeId?: string | null
  thumbnailUrl?: string | null
}

export interface Employee {
  id: string // GHL user id
  firstName: string
  lastName: string
  email: string | null
  isAdManager: boolean
  active: boolean
  /** staff = sees own suggestions; admin/owner = sees everyone's (docs/auth.md). */
  role?: 'staff' | 'admin' | 'owner'
}

export interface Creative {
  id: string
  name: string
  title: string | null
  body: string | null
  callToAction: string | null
  imageUrl: string | null
  videoId: string | null
  videoThumbnailUrl: string | null
  permalinkUrl: string | null
}

export interface MetaLead {
  id: string
  createdAt: string // ISO timestamp
  name: string | null
  email: string | null
  phone: string | null
  formId: string | null
  formName: string | null
  adId: string | null
  adName: string | null
  accountId: string | null
  clientId: number | null
  managerId: string | null
}

export interface DateRange {
  /** Inclusive, YYYY-MM-DD, in the reporting time zone (America/Toronto). */
  from: string
  to: string
}
