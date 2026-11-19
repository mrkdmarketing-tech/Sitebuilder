/**
 * Prospects: people MRKD is talking to who haven't signed yet (docs/prospects.md).
 * Owners only. Chats come from MRKD's GHL sub-account (read-only); Jev reads
 * each chat and suggests the type of business and how warm it is; the owners
 * set value, stage and next step, and can change anything Jev suggested.
 *
 * Used by the prospects-sync function and the Prospects screen.
 */

export const STAGES = [
  { key: 'new', label: 'New' },
  { key: 'call1_booked', label: 'Call 1 booked' },
  { key: 'call1_done', label: 'Call 1 done' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'call2', label: 'Call 2' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
] as const
export type Stage = typeof STAGES[number]['key']
export const OPEN_STAGES: Stage[] = ['new', 'call1_booked', 'call1_done', 'proposal_sent', 'call2']

export const INDUSTRIES = [
  { key: 'jiu_jitsu', label: 'Jiu jitsu', covers: 'A jiu jitsu, BJJ, MMA, Muay Thai, kickboxing, karate or other martial arts gym or academy. Also choose this when the chat talks about gym members, students, classes, trial classes, belts, or leads for gyms, even if the sport is not named.' },
  { key: 'steel', label: 'Steel structures', covers: 'A steel or metal building, steel structure, carport, garage, barn, shed or storage building business' },
  { key: 'other', label: 'Other', covers: 'Any other kind of business' },
] as const
export type Industry = typeof INDUSTRIES[number]['key']

export const TEMPERATURES = [
  { key: 'hot', label: 'Hot', covers: 'Ready to move: asking about price, start dates, contracts or next steps, has booked or asked for a call, or said yes. Replying quickly and recently.' },
  { key: 'warm', label: 'Warm', covers: 'Interested and still talking, but nothing agreed yet; asked for more information or to follow up later.' },
  { key: 'cold', label: 'Cold', covers: 'Stopped replying, said not now or not interested, or only MRKD has been sending messages.' },
] as const
export type Temperature = typeof TEMPERATURES[number]['key']

/** Who the other person is. Only "prospect" is shown on the board by default. */
export const KINDS = [
  { key: 'prospect', covers: 'A business owner or manager who might buy marketing or advertising services from MRKD, or is being sold to' },
  { key: 'client', covers: 'An existing MRKD client talking about their current service, ads, billing or results' },
  { key: 'candidate', covers: 'Someone applying for a job, a hiring test or an interview at MRKD' },
  { key: 'consumer', covers: 'A member of the public, e.g. asking about classes or buying a building for themselves' },
  { key: 'other', covers: 'A vendor, partner, spam, an automated message, or not enough to tell' },
] as const
export type Kind = typeof KINDS[number]['key']

/** Bump when the questions change: prospects-sync asks Jev again. */
export const PROSPECT_VERSION = 2

export const label = <T extends { key: string; label: string }>(list: readonly T[], key: string | null | undefined) =>
  list.find((o) => o.key === key)?.label ?? null

export interface ChatMessage {
  /** inbound = from the prospect, outbound = from MRKD. */
  direction: 'inbound' | 'outbound'
  body: string | null
  type: string | null
  at: string
}

const scrub = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
  .replace(/https?:\/\/\S+/g, '[link]')
  .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
  .replace(/\s+/g, ' ')
  .trim()

/**
 * The chat as Jev reads it: oldest first, "Prospect:" and "MRKD:" lines, with
 * emails, phone numbers and links taken out and no names. Newest messages win
 * when it's long.
 */
export function chatTranscript(messages: ChatMessage[], max = 6000): string {
  const lines = [...messages]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((m) => {
      const text = m.body ? scrub(m.body) : ''
      if (!text) return null
      return `${m.direction === 'inbound' ? 'Prospect' : 'MRKD'} (${m.at.slice(0, 10)}): ${text.slice(0, 800)}`
    })
    .filter((l): l is string => !!l)
  const out: string[] = []
  let size = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    if (size + lines[i].length > max) break
    out.unshift(lines[i])
    size += lines[i].length + 1
  }
  return out.join('\n')
}

/** The request body for TypeSafe's System One API, one chat. */
export function prospectJevRequest(transcript: string, today: string, model = 'jev-latest') {
  return {
    model,
    state: `Today is ${today}. This is a chat between MRKD (a marketing agency that runs Facebook and Instagram ads) and someone it is talking to.\n\n${transcript}`,
    questions: {
      kind: {
        type: 'choice',
        instructions: 'Who is the other person (not MRKD) in this chat?',
        criteria: Object.fromEntries(KINDS.map((k) => [k.key, k.covers])),
      },
      industry: {
        type: 'choice',
        instructions: 'What kind of business does the other person run or work for?',
        criteria: Object.fromEntries(INDUSTRIES.map((k) => [k.key, k.covers])),
      },
      temperature: {
        type: 'choice',
        instructions: `How likely is the other person to become an MRKD client soon, judged from the chat as of today (${today})? Recent replies count more than old ones.`,
        criteria: Object.fromEntries(TEMPERATURES.map((k) => [k.key, k.covers])),
      },
    },
  }
}

export interface ProspectAnswer {
  kind: Kind | null
  industry: Industry | null
  temperature: Temperature | null
  confidence: Partial<Record<'kind' | 'industry' | 'temperature', number>>
}

/** Reads Jev's answer; anything missing or unknown becomes null, never a guess. */
export function parseProspectAnswer(raw: unknown): ProspectAnswer {
  const root = (raw ?? {}) as Record<string, unknown>
  const answers = (root.answers && typeof root.answers === 'object' ? root.answers : root) as Record<string, unknown>
  const pick = <K extends string>(name: 'kind' | 'industry' | 'temperature', keys: readonly { key: K }[], out: ProspectAnswer) => {
    const a = answers[name] as { choice?: unknown; confidence?: unknown } | undefined
    const choice = typeof a?.choice === 'string' && keys.some((k) => k.key === a.choice) ? a.choice as K : null
    if (choice && typeof a?.confidence === 'number') out.confidence[name] = a.confidence
    return choice
  }
  const out: ProspectAnswer = { kind: null, industry: null, temperature: null, confidence: {} }
  out.kind = pick('kind', KINDS, out)
  out.industry = pick('industry', INDUSTRIES, out)
  out.temperature = pick('temperature', TEMPERATURES, out)
  return out
}

/**
 * A stage from the prospect's GHL pipeline stage, for prospects the owners
 * haven't given a stage yet. Unknown stages are "new".
 */
export function stageFromGhl(ghlStage: string | null | undefined): Stage {
  const s = (ghlStage ?? '').toLowerCase()
  if (!s) return 'new'
  if (/\bwon\b|sold|closed - facebook|onboarded|verbal yes/.test(s)) return 'won'
  if (/lost|not interested|not a fit/.test(s)) return 'lost'
  if (/proposal|audit sent/.test(s)) return 'proposal_sent'
  if (/call held|audit call completed/.test(s)) return 'call1_done'
  if (/call booked|demo booked/.test(s)) return 'call1_booked'
  return 'new'
}

/** GHL pipelines that are not sales (clients, hiring, training): their contacts aren't prospects. */
export const NOT_SALES_PIPELINES = /current clients|mb clients|leadlabz clients|old clients|onboarded clients|talent acquisition|sales training|test pipeline/i

export interface ProspectRow {
  contactId: string
  name: string
  company: string | null
  source: 'ghl' | 'manual'
  channel: string | null
  /** Set by an owner (wins) or suggested by Jev. */
  industry: Industry | null
  aiIndustry: Industry | null
  temperature: Temperature | null
  aiTemperature: Temperature | null
  aiKind: Kind | null
  /** Dollars a month. */
  value: number | null
  stage: Stage | null
  nextStep: string | null
  nextDate: string | null
  notes: string | null
  hidden: boolean
  lastMessageAt: string | null
  lastFrom: 'them' | 'us' | null
  lastPreview: string | null
  messageCount: number
  ghlPipeline: string | null
  ghlStage: string | null
  ghlValue: number | null
  updatedAt: string | null
  updatedBy: string | null
}

export const industryOf = (p: Pick<ProspectRow, 'industry' | 'aiIndustry'>) => p.industry ?? p.aiIndustry
export const temperatureOf = (p: Pick<ProspectRow, 'temperature' | 'aiTemperature'>) => p.temperature ?? p.aiTemperature
export const stageOf = (p: Pick<ProspectRow, 'stage' | 'ghlStage'>): Stage => p.stage ?? stageFromGhl(p.ghlStage)

/**
 * Shown on the board: Jev read the chat as a prospect, an owner added it by
 * hand, or an owner has given it a stage, value, type or temperature. The rest
 * (clients, job applicants, vendors, calls with nothing to read) are under
 * "Not on the board", where an owner can move one over.
 */
export const onBoard = (p: Pick<ProspectRow, 'hidden' | 'aiKind' | 'source' | 'stage' | 'value' | 'industry' | 'temperature'>) =>
  !p.hidden && (p.source === 'manual' || p.aiKind === 'prospect' || p.stage != null || p.value != null || p.industry != null || p.temperature != null)

export interface PipelineTotals {
  open: number
  openValue: number
  byTemperature: Record<Temperature | 'unknown', { count: number; value: number }>
  won: { count: number; value: number }
}

/** Value of open prospects by temperature, and what's been won. */
export function pipelineTotals(rows: ProspectRow[]): PipelineTotals {
  const t: PipelineTotals = {
    open: 0, openValue: 0, won: { count: 0, value: 0 },
    byTemperature: { hot: { count: 0, value: 0 }, warm: { count: 0, value: 0 }, cold: { count: 0, value: 0 }, unknown: { count: 0, value: 0 } },
  }
  for (const p of rows) {
    const stage = stageOf(p)
    const v = p.value ?? 0
    if (stage === 'won') { t.won.count++; t.won.value += v; continue }
    if (stage === 'lost') continue
    t.open++
    t.openValue += v
    const b = t.byTemperature[temperatureOf(p) ?? 'unknown']
    b.count++
    b.value += v
  }
  return t
}

/** "They replied 2 days ago", "You messaged 3 weeks ago, no reply". */
export function lastContact(p: Pick<ProspectRow, 'lastMessageAt' | 'lastFrom'>, now = new Date()): string | null {
  if (!p.lastMessageAt) return null
  const days = Math.floor((now.getTime() - new Date(p.lastMessageAt).getTime()) / 86_400_000)
  const ago = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`
  return p.lastFrom === 'them' ? `They wrote ${ago}` : `MRKD wrote ${ago}${days >= 3 ? ', no reply' : ''}`
}

export const money = (n: number | null | undefined) =>
  n == null ? '' : `$${Math.round(n).toLocaleString('en-US')}`
