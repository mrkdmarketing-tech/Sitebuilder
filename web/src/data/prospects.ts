/**
 * Prospects data (owners only, docs/prospects.md). Live: the prospects and
 * prospect_messages tables (migration 3700); row-level security returns
 * nothing to anyone who isn't an owner with two-step sign-in. Sample mode:
 * fictional prospects kept in memory.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage, Industry, ProspectRow, Stage, Temperature } from '@shared/domain/prospects.ts'

export interface ProspectChange {
  industry?: Industry | null
  temperature?: Temperature | null
  value?: number | null
  stage?: Stage | null
  nextStep?: string | null
  nextDate?: string | null
  notes?: string | null
  hidden?: boolean
}

export interface NewProspect {
  name: string
  company?: string | null
  channel?: string | null
  industry?: Industry | null
  temperature?: Temperature | null
  value?: number | null
  stage?: Stage | null
  notes?: string | null
}

/** A GHL contact found by search. */
export interface GhlContactResult {
  contactId: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  /** on_board = already on the board; removed = marked not a prospect; client = a client in GHL; new = not in Prospects. */
  state: 'on_board' | 'removed' | 'client' | 'new'
}

export interface ProspectsApi {
  list(): Promise<ProspectRow[]>
  /** The chat, oldest first. */
  messages(contactId: string): Promise<(ChatMessage & { id: string })[]>
  save(contactId: string, change: ProspectChange): Promise<void>
  /** Someone not in GHL (e.g. a personal Facebook chat). */
  add(p: NewProspect): Promise<void>
  /** Only ones added by hand. */
  remove(contactId: string): Promise<void>
  /** Search every contact in MRKD's GHL sub-account. */
  searchGhl(query: string): Promise<GhlContactResult[]>
  /** Put a GHL contact on the board (reads their chat; Jev reads it too). */
  addFromGhl(contactId: string): Promise<{ name: string }>
}

async function invoke<T>(db: SupabaseClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke('prospects-action', { body })
  if (error) {
    let message = error.message
    try { message = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? message } catch { /* keep */ }
    throw new Error(message)
  }
  return data as T
}

const COLUMNS = 'contact_id, source, name, company, channel, industry, ai_industry, temperature, ai_temperature, ai_kind, value, stage, next_step, next_date, notes, hidden, last_message_at, last_from, last_preview, message_count, ghl_pipeline, ghl_stage, ghl_value, updated_at, employees(first_name)'

const toNum = (v: unknown) => (v == null || v === '' ? null : Number(v))

function toRow(r: Record<string, unknown>): ProspectRow {
  return {
    contactId: r.contact_id as string,
    name: r.name as string,
    company: (r.company as string) ?? null,
    source: r.source as ProspectRow['source'],
    channel: (r.channel as string) ?? null,
    industry: (r.industry as Industry) ?? null,
    aiIndustry: (r.ai_industry as Industry) ?? null,
    temperature: (r.temperature as Temperature) ?? null,
    aiTemperature: (r.ai_temperature as Temperature) ?? null,
    aiKind: (r.ai_kind as ProspectRow['aiKind']) ?? null,
    value: toNum(r.value),
    stage: (r.stage as Stage) ?? null,
    nextStep: (r.next_step as string) ?? null,
    nextDate: (r.next_date as string) ?? null,
    notes: (r.notes as string) ?? null,
    hidden: !!r.hidden,
    lastMessageAt: (r.last_message_at as string) ?? null,
    lastFrom: (r.last_from as ProspectRow['lastFrom']) ?? null,
    lastPreview: (r.last_preview as string) ?? null,
    messageCount: Number(r.message_count ?? 0),
    ghlPipeline: (r.ghl_pipeline as string) ?? null,
    ghlStage: (r.ghl_stage as string) ?? null,
    ghlValue: toNum(r.ghl_value),
    updatedAt: (r.updated_at as string) ?? null,
    updatedBy: ((r.employees as { first_name?: string } | null)?.first_name) ?? null,
  }
}

function toDb(c: ProspectChange) {
  const out: Record<string, unknown> = {}
  if ('industry' in c) out.industry = c.industry
  if ('temperature' in c) out.temperature = c.temperature
  if ('value' in c) out.value = c.value
  if ('stage' in c) out.stage = c.stage
  if ('nextStep' in c) out.next_step = c.nextStep?.trim() || null
  if ('nextDate' in c) out.next_date = c.nextDate || null
  if ('notes' in c) out.notes = c.notes?.trim() || null
  if ('hidden' in c) out.hidden = c.hidden
  return out
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export function createSupabaseProspects(db: SupabaseClient): ProspectsApi {
  return {
    async list() {
      const rows = check(await db.from('prospects').select(COLUMNS).order('last_message_at', { ascending: false, nullsFirst: false }).limit(2000))
      return (rows as Record<string, unknown>[]).map(toRow)
    },
    async messages(contactId) {
      const rows = check(await db.from('prospect_messages').select('message_id, direction, type, body, at').eq('contact_id', contactId).order('at'))
      return (rows as Record<string, string>[]).map((m) => ({ id: m.message_id, direction: m.direction as ChatMessage['direction'], type: m.type, body: m.body, at: m.at }))
    },
    async save(contactId, change) {
      check(await db.from('prospects').update(toDb(change)).eq('contact_id', contactId))
    },
    async add(p) {
      check(await db.from('prospects').insert({
        contact_id: `manual-${crypto.randomUUID()}`, source: 'manual', name: p.name.trim(), company: p.company?.trim() || null,
        channel: p.channel?.trim() || null, industry: p.industry ?? null, temperature: p.temperature ?? null,
        value: p.value ?? null, stage: p.stage ?? 'new', notes: p.notes?.trim() || null,
      }))
    },
    async remove(contactId) {
      check(await db.from('prospects').delete().eq('contact_id', contactId).eq('source', 'manual'))
    },
    async searchGhl(query) {
      return (await invoke<{ results: GhlContactResult[] }>(db, { action: 'search', query })).results
    },
    async addFromGhl(contactId) {
      return invoke<{ name: string }>(db, { action: 'add', contactId })
    },
  }
}

// ---------------------------------------------------------------------------
// Sample mode: fictional prospects (no real names, kept in memory).

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function sampleRows(): ProspectRow[] {
  const base = {
    source: 'ghl' as const, industry: null, temperature: null, value: null, stage: null, nextStep: null, nextDate: null,
    notes: null, hidden: false, ghlPipeline: null, ghlStage: null, ghlValue: null, updatedAt: null, updatedBy: null, aiKind: 'prospect' as const,
  }
  return [
    { ...base, contactId: 's1', name: 'Sam Rivers', company: 'Riverside BJJ', channel: 'SMS', aiIndustry: 'jiu_jitsu', aiTemperature: 'hot', value: 1500, stage: 'proposal_sent', nextStep: 'Call back about the contract', nextDate: day(-2).slice(0, 10), lastMessageAt: day(1), lastFrom: 'them', lastPreview: 'Looks good, can we start the 1st?', messageCount: 18 },
    { ...base, contactId: 's2', name: 'Pat Steele', company: 'Summit Steel Buildings', channel: 'Facebook', aiIndustry: 'steel', aiTemperature: 'warm', lastMessageAt: day(4), lastFrom: 'us', lastPreview: 'Here are a few examples of ads we run for steel building companies.', messageCount: 9, ghlPipeline: 'MB - Sales Pipeline', ghlStage: 'Call Booked' },
    { ...base, contactId: 's3', name: 'Drew Lake', company: null, channel: 'Instagram', aiIndustry: 'jiu_jitsu', aiTemperature: 'warm', value: 900, lastMessageAt: day(6), lastFrom: 'them', lastPreview: 'Lets touch base in December', messageCount: 12 },
    { ...base, contactId: 's4', name: 'Casey Ward', company: 'Ward Metal Carports', channel: 'SMS', aiIndustry: 'steel', aiTemperature: 'cold', lastMessageAt: day(25), lastFrom: 'us', lastPreview: 'Just following up here', messageCount: 6 },
    { ...base, contactId: 's5', name: 'Morgan Fox', company: 'Fox Fitness', channel: 'Email', aiIndustry: 'other', aiTemperature: 'cold', lastMessageAt: day(40), lastFrom: 'us', lastPreview: 'Any thoughts on the proposal?', messageCount: 4, stage: 'call1_done' },
    { ...base, contactId: 's6', name: 'Riley Stone', company: 'Stone MMA', channel: 'SMS', aiIndustry: 'jiu_jitsu', aiTemperature: 'hot', value: 1200, stage: 'won', lastMessageAt: day(2), lastFrom: 'them', lastPreview: 'Signed!', messageCount: 30 },
    { ...base, contactId: 's7', name: 'Hiring applicant', company: null, channel: 'Email', aiIndustry: 'other', aiTemperature: 'cold', aiKind: 'candidate', lastMessageAt: day(3), lastFrom: 'them', lastPreview: 'Submitted my test', messageCount: 3 },
  ]
}

export function createMockProspects(): ProspectsApi {
  let rows = sampleRows()
  return {
    async list() { return rows.map((r) => ({ ...r })) },
    async messages(contactId) {
      const r = rows.find((x) => x.contactId === contactId)
      if (!r || r.source === 'manual') return []
      return [
        { id: `${contactId}-1`, direction: 'inbound', type: 'TYPE_SMS', body: 'Hi, saw your ads. What would it cost to run something like that for us?', at: day(12) },
        { id: `${contactId}-2`, direction: 'outbound', type: 'TYPE_SMS', body: 'Happy to walk you through it. Do you have 20 minutes this week for a call?', at: day(11) },
        { id: `${contactId}-3`, direction: r.lastFrom === 'them' ? 'inbound' : 'outbound', type: 'TYPE_SMS', body: r.lastPreview, at: r.lastMessageAt ?? day(1) },
      ]
    },
    async save(contactId, change) {
      rows = rows.map((r) => (r.contactId === contactId ? { ...r, ...change, updatedAt: new Date().toISOString(), updatedBy: 'Olive' } : r))
    },
    async add(p) {
      rows = [{
        contactId: `manual-${Math.random().toString(36).slice(2)}`, source: 'manual', name: p.name, company: p.company ?? null, channel: p.channel ?? null,
        industry: p.industry ?? null, aiIndustry: null, temperature: p.temperature ?? null, aiTemperature: null, aiKind: null,
        value: p.value ?? null, stage: p.stage ?? 'new', nextStep: null, nextDate: null, notes: p.notes ?? null, hidden: false,
        lastMessageAt: null, lastFrom: null, lastPreview: null, messageCount: 0, ghlPipeline: null, ghlStage: null, ghlValue: null,
        updatedAt: new Date().toISOString(), updatedBy: 'Olive',
      }, ...rows]
    },
    async remove(contactId) { rows = rows.filter((r) => r.contactId !== contactId || r.source !== 'manual') },
    async searchGhl(query) {
      const q = query.trim().toLowerCase()
      if (q.length < 2) return []
      const extra: GhlContactResult[] = [{ contactId: 'g1', name: 'Taylor Brooks', company: 'Brooks Barns & Steel', email: null, phone: null, state: 'new' }]
      return [
        ...rows.map((r): GhlContactResult => ({ contactId: r.contactId, name: r.name, company: r.company, email: null, phone: null, state: r.hidden ? 'removed' : 'on_board' })),
        ...extra.filter((e) => !rows.some((r) => r.contactId === e.contactId)),
      ].filter((r) => [r.name, r.company].some((v) => v?.toLowerCase().includes(q)))
    },
    async addFromGhl(contactId) {
      const r = rows.find((x) => x.contactId === contactId)
      if (r) { rows = rows.map((x) => (x.contactId === contactId ? { ...x, hidden: false, stage: x.stage ?? 'new' } : x)); return { name: r.name } }
      rows = [{
        contactId, source: 'ghl', name: 'Taylor Brooks', company: 'Brooks Barns & Steel', channel: 'SMS', industry: null, aiIndustry: 'steel',
        temperature: null, aiTemperature: 'warm', aiKind: 'prospect', value: null, stage: 'new', nextStep: null, nextDate: null, notes: null,
        hidden: false, lastMessageAt: day(8), lastFrom: 'them', lastPreview: 'Send me some examples', messageCount: 5,
        ghlPipeline: null, ghlStage: null, ghlValue: null, updatedAt: new Date().toISOString(), updatedBy: 'Olive',
      }, ...rows]
      return { name: 'Taylor Brooks' }
    },
  }
}
