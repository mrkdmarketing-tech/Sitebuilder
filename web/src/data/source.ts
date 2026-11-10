/**
 * The app reads data ONLY through this interface. Two implementations:
 *   - mockSource:     fictional sample data generated in the browser (no Supabase needed)
 *   - supabaseSource: the real database via Supabase RPCs (supabase/migrations/0600)
 * Screens don't know or care which one they get. See docs/architecture.md.
 */
import { createContext, useContext } from 'react'
import type { Creative, DateRange, Employee, Level, MetaLead, ReportRow } from '@shared/domain/types.ts'
import type { RuleSettings, Suggestion } from '@shared/domain/rules.ts'

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

export interface TurnOffResult {
  ok: boolean
  message: string
  /** The account only allows viewing; MRKDPlatformTools needs "Manage campaigns". */
  needsManageCampaigns?: boolean
}

/** One "Turn off" attempt from the audit log. */
export interface ActionRecord {
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
  /** "Not now" (back in 24 h) or "Dismiss" (not suggested again for 7 days). */
  updateSuggestion(id: string, status: 'snoozed' | 'dismissed'): Promise<void>
  /** "Turn off": pauses the ad in Meta through the meta-action function. */
  turnOffAd(suggestionId: string): Promise<TurnOffResult>
  /** Latest "Turn off" attempts (audit log), newest first. */
  recentActions(limit?: number): Promise<ActionRecord[]>
  /** When the data was last refreshed (for the "Updated 4 min ago" stamp). */
  lastUpdated(): Promise<string | null>
}

export const DataContext = createContext<DataSource | null>(null)

export function useData(): DataSource {
  const ds = useContext(DataContext)
  if (!ds) throw new Error('useData must be used inside <DataContext.Provider>')
  return ds
}
