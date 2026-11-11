/**
 * The app reads data ONLY through this interface. Two implementations:
 *   - mockSource:     fictional sample data generated in the browser (no Supabase needed)
 *   - supabaseSource: the real database via Supabase RPCs (supabase/migrations/0600)
 * Screens don't know or care which one they get. See docs/architecture.md.
 */
import { createContext, useContext } from 'react'
import type { Creative, DateRange, Employee, Level, MetaLead, ReportRow } from '@shared/domain/types.ts'
import type { RuleSettings, Suggestion } from '@shared/domain/rules.ts'
import type { ApprovalsApi } from './approvals'

export interface LeadFormResult {
  id: string
  name: string
  pageId: string | null
  questions: string[]
  contextCardTitle: string | null
  thankYouTitle: string | null
}

export interface SyncRun {
  job: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'ok' | 'error' | 'partial'
  rows: number | null
  error: string | null
}

/** A suggestion saved by the run-rules job (has an id so it can be acted on). */
export interface StoredSuggestion extends Suggestion {
  id: string
  lastSeenAt: string
}

export interface CreativeTagRow {
  dimension: 'offer' | 'audience' | 'hook' | 'format'
  value: string | null
  ads: number
  accounts: number
  spend: number
  leads: number
}

export interface TurnOffResult {
  ok: boolean
  message: string
  /** The account only allows viewing; MRKDPlatformTools needs "Manage campaigns". */
  needsManageCampaigns?: boolean
  /** Meta was asked again afterwards and shows the new status. */
  verified?: boolean
  /** It was already off; nothing changed. */
  alreadyOff?: boolean
  /** When it was done. */
  at?: string
}

/** One "Turn off" (or "Undo") attempt from the audit log. */
export interface ActionRecord {
  /** off = Turn off, on = Undo (turned back on). */
  kind: 'off' | 'on'
  /** The suggestion it came from, for Undo. */
  suggestionId: string | null
  at: string
  who: string | null
  adName: string | null
  accountName: string | null
  ok: boolean
  note: string | null
}

export interface RuleSettingsInfo {
  params: Partial<RuleSettings>
  updatedAt: string | null
  updatedBy: string | null
}

/** One row of Settings -> Staff (staff_overview(), migration 2300). */
export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  email: string | null
  isAdManager: boolean
  active: boolean
  role: 'staff' | 'admin' | 'owner'
  /** Has signed in to The Lab at least once. */
  signedIn: boolean
  /** Uses an authenticator app to confirm sign-in. */
  twoStep?: boolean
  /** Active/New clients assigned to them in GHL. */
  clients: number
}

/** One row of the Clients screen (client_list(), migration 2500). */
export interface ClientRow {
  id: number
  name: string
  status: string | null
  managerId: string | null
  managerName: string | null
  city: string | null
  state: string | null
  /** Something about this client was changed in The Lab (wins over GHL/Retool). */
  overridden: boolean
  statusOverride: string | null
  managerOverride: string | null
  note: string | null
  overrideBy: string | null
  overrideAt: string | null
  accounts: { id: string; name: string | null; status: string | null; linkedInLab: boolean }[]
}

export interface ClientChange {
  status?: string
  managerId?: string
  link?: string[]
  unlink?: string[]
  note?: string
  /** Remove every Lab change for this client; GHL/Retool decide again on the next copy. */
  clear?: boolean
}

export interface DataSource {
  readonly kind: 'sample' | 'supabase'
  /** The signed-in employee (null if signed in but not an employee). */
  me(): Promise<Employee | null>
  employees(): Promise<Employee[]>
  /** Raw totals per entity for a level and date range (Active/New clients only). */
  report(level: Level, range: DateRange): Promise<ReportRow[]>
  leads(range: DateRange): Promise<MetaLead[]>
  creative(id: string): Promise<Creative | null>
  /** Meta leads per account over the last N days (suggestion rule 7). */
  recentLeadsByAccount(days: number): Promise<Map<string, number>>
  ruleSettings(): Promise<Partial<RuleSettings>>
  /** Thresholds plus who last changed them (Settings screen). */
  ruleSettingsInfo(): Promise<RuleSettingsInfo>
  /** Owners/admins: save thresholds (checked and logged by save_rule_settings, migration 2000). */
  saveRuleSettings(params: Partial<RuleSettings>): Promise<void>
  searchLeadForms(query: string): Promise<LeadFormResult[]>
  searchAdCopy(query: string): Promise<Creative[]>
  syncRuns(): Promise<SyncRun[]>
  /** Saved suggestions the signed-in person may see (null = compute them in the browser, sample mode). */
  storedSuggestions(): Promise<StoredSuggestion[] | null>
  /** Insights -> What's working: spend and leads by creative tag across all accounts (migration 2800). */
  creativeTagReport(range: DateRange): Promise<CreativeTagRow[]>
  /** "Not now" (back in 24 h), "Dismiss" (not suggested again for 7 days), or "open" to undo either. */
  updateSuggestion(id: string, status: 'snoozed' | 'dismissed' | 'open'): Promise<void>
  /** "Turn off": pauses the ad in Meta through the meta-action function. */
  turnOffAd(suggestionId: string): Promise<TurnOffResult>
  /** "Undo": turns it back on (within 24 hours of a Turn off made here). */
  undoTurnOff(suggestionId: string): Promise<TurnOffResult>
  /** Latest "Turn off" attempts (audit log), newest first. */
  recentActions(limit?: number): Promise<ActionRecord[]>
  /** When the data was last refreshed (for the "Updated 4 min ago" stamp). */
  lastUpdated(): Promise<string | null>
  /** Settings -> Staff. */
  staff(): Promise<StaffMember[]>
  /** Owners/admins: change someone's role (rules and log in set_employee_role, migration 2300). */
  setRole(employeeId: string, role: StaffMember['role']): Promise<void>
  /** Owners/admins: lost phone, remove someone's authenticator so they set it up again. */
  resetTwoStep(employeeId: string): Promise<void>
  /** Owners/admins: take someone off the team in The Lab, or add them back. */
  setStaffActive(employeeId: string, active: boolean, note?: string): Promise<void>
  /** Clients screen. */
  clients(): Promise<ClientRow[]>
  /** Ad accounts not linked to any client (to link one). */
  unlinkedAccounts(): Promise<{ id: string; name: string | null; status: string | null }[]>
  /** Owners/admins: change a client's status, ads manager or ad accounts (set_client_control). */
  setClient(clientId: number, change: ClientChange): Promise<void>
  /** Ad approval (docs/ad-approval.md). */
  readonly approvals: ApprovalsApi
}

export const DataContext = createContext<DataSource | null>(null)

export function useData(): DataSource {
  const ds = useContext(DataContext)
  if (!ds) throw new Error('useData must be used inside <DataContext.Provider>')
  return ds
}
