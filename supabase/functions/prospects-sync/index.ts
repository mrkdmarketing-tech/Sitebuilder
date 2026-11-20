/**
 * prospects-sync: builds the owners-only Prospects board from MRKD's GHL
 * sub-account (docs/prospects.md). Read-only with GHL.
 *
 *  1. Sales pipelines and opportunities (stage and value in GHL).
 *  2. Chats from the last 120 days (GET /conversations/search), leaving out
 *     clients, the team (email, MRKD's email domain or phone), and contacts only in client /
 *     hiring pipelines.
 *  3. The latest 40 messages of each chat that changed since the last run.
 *  4. Jev reads each changed chat (no names, emails, phone numbers or links)
 *     and suggests: who they are (prospect, client, job applicant...), the type
 *     of business (jiu jitsu, steel structures, other) and hot / warm / cold.
 *
 * Owners' own fields (value, stage, notes, their own type and temperature)
 * are never touched here. Every 30 minutes at :05 and :35 (migration 3700).
 * Secrets: GHL_PRIVATE_TOKEN (needs View Conversations, View Conversation
 * Messages, View Opportunities), TYPESAFE_API_KEY.
 */
import { GHL_API, GHL_VERSION, MRKD_LOCATION_ID, explainGhlError } from '../../../shared/domain/ghl.ts'
import {
  NOT_SALES_PIPELINES, PROSPECT_VERSION, chatTranscript, parseProspectAnswer, prospectJevRequest, type ChatMessage,
} from '../../../shared/domain/prospects.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'

const DAYS = 120
const MAX_MESSAGE_READS = 200
const MAX_JEV = 80
const JEV_API = 'https://api.typesafe.ai/v1/systemone'
const JEV_MODEL = Deno.env.get('JEV_MODEL') ?? 'jev-latest'

class Stop extends Error {}

type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)
const iso = (v: unknown) => {
  const n = num(v)
  const d = n != null ? new Date(n) : typeof v === 'string' ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}
const CHANNELS: Record<string, string> = {
  TYPE_SMS: 'SMS', TYPE_EMAIL: 'Email', TYPE_FACEBOOK: 'Facebook', TYPE_INSTAGRAM: 'Instagram', TYPE_CALL: 'Call',
  TYPE_WHATSAPP: 'WhatsApp', TYPE_GMB: 'Google', TYPE_LIVE_CHAT: 'Website chat', TYPE_WEBCHAT: 'Website chat',
}
const time = (v: string | null | undefined) => (v ? new Date(v).getTime() || 0 : 0)
/** Last 10 digits, to match phone numbers written differently. */
const phoneKey = (v: unknown) => (typeof v === 'string' ? v.replace(/\D/g, '').slice(-10) : '')
const channelOf = (t: unknown) => (typeof t === 'string' ? CHANNELS[t] ?? t.replace(/^TYPE_/, '').replace(/_/g, ' ').toLowerCase() : null)

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await work(items[i++])
  }))
}

/** Keys and value types only (no values): to check GHL's response shapes. */
function shape(v: unknown, depth = 0): unknown {
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1)] : []
  if (v && typeof v === 'object') {
    if (depth > 3) return 'object'
    return Object.fromEntries(Object.entries(v as Obj).map(([k, x]) => [k, shape(x, depth + 1)]))
  }
  return typeof v
}

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const token = Deno.env.get('GHL_PRIVATE_TOKEN')
  const jevKey = Deno.env.get('TYPESAFE_API_KEY')
  const location = Deno.env.get('GHL_LOCATION_ID') ?? MRKD_LOCATION_ID
  const db = serviceClient()
  const url = new URL(req.url)

  const ghl = async (path: string): Promise<Obj> => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${GHL_API}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json' },
      })
      if (res.ok) return await res.json() as Obj
      const body = await res.text()
      if (res.status === 429 && attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue }
      const msg = explainGhlError(res.status, path.split('?')[0], body)
      if (res.status === 401 || res.status === 403) throw new Stop(msg)
      throw new Error(msg)
    }
  }

  const askJev = async (request: unknown): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(JEV_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jevKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      if (res.ok) return res.json()
      const text = (await res.text()).slice(0, 300)
      if (res.status === 401 || res.status === 403) throw new Stop(`TypeSafe refused the key (${res.status}): ${text}`)
      if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue }
      throw new Error(`TypeSafe ${res.status}: ${text}`)
    }
  }

  // ?probe=shape: field names GHL returns (no values), to check this function's reads.
  if (url.searchParams.get('probe') === 'shape' && token) {
    try {
      const conv = await ghl(`/conversations/search?locationId=${location}&limit=2&sortBy=last_message_date&sort=desc`)
      const first = (conv.conversations as Obj[] | undefined)?.[0]
      const msgs = first ? await ghl(`/conversations/${first.id}/messages?limit=2`) : null
      const opps = await ghl(`/opportunities/search?location_id=${location}&limit=2`)
      return json({ conversations: shape(conv), messages: shape(msgs), opportunities: shape(opps) })
    } catch (err) {
      return json({ error: (err as Error).message }, 500)
    }
  }

  try {
    const result = await logRun(db, 'prospects.sync', async () => {
      if (!token) return { rows: 0, details: { skipped: 'GHL_PRIVATE_TOKEN is not set.' } }
      const now = new Date()
      const cutoff = now.getTime() - DAYS * 86_400_000

      // 1. Pipelines and opportunities.
      const pipes = await ghl(`/opportunities/pipelines?locationId=${location}`)
      const pipelineName = new Map<string, string>()
      const stageName = new Map<string, string>()
      for (const p of (pipes.pipelines ?? []) as Obj[]) {
        pipelineName.set(String(p.id), String(p.name ?? ''))
        for (const s of (p.stages ?? []) as Obj[]) stageName.set(String(s.id), String(s.name ?? ''))
      }
      const oppByContact = new Map<string, { pipeline: string; stage: string | null; value: number | null; at: string }>()
      const pipelinesByContact = new Map<string, Set<string>>()
      let after = ''
      for (let page = 1; page <= 20; page++) {
        const body = await ghl(`/opportunities/search?location_id=${location}&limit=100${after || `&page=${page}`}`)
        const list = (body.opportunities ?? []) as Obj[]
        for (const o of list) {
          const contact = str(o.contactId) ?? str((o.contact as Obj | undefined)?.id)
          if (!contact) continue
          const pipeline = pipelineName.get(String(o.pipelineId)) ?? ''
          if (!pipelinesByContact.has(contact)) pipelinesByContact.set(contact, new Set())
          pipelinesByContact.get(contact)!.add(pipeline)
          if (NOT_SALES_PIPELINES.test(pipeline)) continue
          const at = iso(o.updatedAt) ?? iso(o.lastStatusChangeAt) ?? ''
          const prev = oppByContact.get(contact)
          if (!prev || at > prev.at) {
            oppByContact.set(contact, { pipeline, stage: stageName.get(String(o.pipelineStageId)) ?? null, value: num(o.monetaryValue), at })
          }
        }
        const meta = (body.meta ?? {}) as Obj
        if (list.length < 100) break
        after = meta.startAfterId && meta.startAfter ? `&startAfterId=${meta.startAfterId}&startAfter=${meta.startAfter}` : ''
      }

      // Who isn't a prospect: clients (any Client Status), the team.
      const notProspect = new Set<string>()
      const { data: clientRows } = await db.from('clients').select('ghl_contact_id').not('ghl_contact_id', 'is', null)
      for (const c of clientRows ?? []) notProspect.add(c.ghl_contact_id)
      const { data: statusRows } = await db.from('ghl_contacts_live').select('contact_id').not('client_status', 'is', null)
      for (const c of statusRows ?? []) notProspect.add(c.contact_id)
      const { data: team } = await db.from('ghl_users_live').select('email, data')
      const teamEmails = new Set((team ?? []).map((u) => (u.email ?? '').toLowerCase()).filter(Boolean))
      const teamPhones = new Set((team ?? []).map((u) => phoneKey((u.data as Obj | null)?.phone)).filter(Boolean))
      // MRKD's own email domains (from the team's GHL logins; free mail like gmail.com doesn't count).
      const FREE_MAIL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail)\./i
      const teamDomains = new Set([...teamEmails].map((e) => e.split('@')[1] ?? '').filter((d) => d && !FREE_MAIL.test(d)))

      // 2. Recent chats.
      const chats: Obj[] = []
      let startAfter = ''
      for (let page = 0; page < 15; page++) {
        const body = await ghl(`/conversations/search?locationId=${location}&limit=100&sortBy=last_message_date&sort=desc${startAfter}`)
        const list = (body.conversations ?? []) as Obj[]
        let older = false
        for (const c of list) {
          const at = num(c.lastMessageDate)
          if (at != null && at < cutoff) { older = true; break }
          chats.push(c)
        }
        if (older || list.length < 100) break
        const last = list[list.length - 1]
        const sortKey = Array.isArray(last.sort) ? last.sort[0] : last.lastMessageDate
        startAfter = `&startAfterDate=${sortKey}`
      }
      let skipped = 0
      const dropped = new Set<string>()
      const candidates = chats.filter((c) => {
        const contact = str(c.contactId)
        const email = (str(c.email) ?? '').toLowerCase()
        const pipelines = contact ? [...(pipelinesByContact.get(contact) ?? [])] : []
        const onlyNonSales = pipelines.length > 0 && pipelines.every((p) => NOT_SALES_PIPELINES.test(p))
        const phone = phoneKey(c.phone)
        const ok = contact && !notProspect.has(contact) && !(email && (teamEmails.has(email) || teamDomains.has(email.split('@')[1] ?? ''))) && !(phone && teamPhones.has(phone)) && !onlyNonSales
        if (!ok && contact) dropped.add(contact)
        if (!ok) skipped++
        return ok
      })

      // Rows from earlier runs that are now left out (became a client, the team),
      // unless an owner has worked on them (gave a stage or value, or removed them).
      if (dropped.size) {
        await db.from('prospects').delete().eq('source', 'ghl').eq('hidden', false).is('stage', null).is('value', null)
          .in('contact_id', [...dropped])
      }

      const { data: known } = await db.from('prospects').select('contact_id, last_message_at, ai_read_until, ai_version, message_count')
      const existing = new Map((known ?? []).map((p) => [p.contact_id as string, p]))

      const rows = candidates.map((c) => {
        const contact = String(c.contactId)
        const opp = oppByContact.get(contact)
        const name = str(c.fullName) ?? str(c.contactName) ?? str(c.companyName) ?? str(c.email) ?? str(c.phone) ?? 'Unknown'
        return {
          contact_id: contact, source: 'ghl', name: name.slice(0, 200), company: str(c.companyName)?.slice(0, 200) ?? null,
          email: str(c.email), phone: str(c.phone), channel: channelOf(c.lastMessageType ?? c.type),
          tags: Array.isArray(c.tags) ? (c.tags as unknown[]).filter((t) => typeof t === 'string') : [],
          last_message_at: iso(c.lastMessageDate),
          last_from: c.lastMessageDirection === 'inbound' ? 'them' : c.lastMessageDirection === 'outbound' ? 'us' : null,
          last_preview: str(c.lastMessageBody)?.slice(0, 200) ?? null,
          ghl_pipeline: opp?.pipeline ?? null, ghl_stage: opp?.stage ?? null, ghl_value: opp?.value ?? null,
          synced_at: now.toISOString(),
          _conversation: String(c.id),
        }
      })
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from('prospects').upsert(rows.slice(i, i + 200).map(({ _conversation, ...r }) => r))
        if (error) throw new Error(error.message)
      }

      // 3. Messages for chats that changed.
      const changed = rows.filter((r) => {
        const e = existing.get(r.contact_id)
        return !e || !e.message_count || time(r.last_message_at) > time(e.last_message_at)
      }).slice(0, MAX_MESSAGE_READS)
      let messagesRead = 0
      let messageProblems = 0
      let firstProblem: string | null = null
      await pool(changed, 4, async (r) => {
        try {
          const body = await ghl(`/conversations/${r._conversation}/messages?limit=40`)
          const inner = (body.messages ?? {}) as Obj
          const list = (Array.isArray(inner) ? inner : (inner.messages ?? [])) as Obj[]
          const msgs = list.map((m) => ({
            message_id: String(m.id), contact_id: r.contact_id,
            direction: m.direction === 'inbound' ? 'inbound' : 'outbound',
            type: str(m.messageType) ?? (typeof m.type === 'number' ? String(m.type) : null),
            body: str(m.body)?.slice(0, 4000) ?? null,
            at: iso(m.dateAdded) ?? now.toISOString(),
          })).filter((m) => m.message_id && m.message_id !== 'undefined')
          if (msgs.length) {
            const { error } = await db.from('prospect_messages').upsert(msgs)
            if (error) throw new Error(error.message)
          }
          const { count } = await db.from('prospect_messages').select('message_id', { count: 'exact', head: true }).eq('contact_id', r.contact_id)
          await db.from('prospects').update({ message_count: count ?? msgs.length }).eq('contact_id', r.contact_id)
          messagesRead++
        } catch (err) {
          if (err instanceof Stop) throw err
          messageProblems++
          firstProblem ??= (err as Error).message
        }
      })

      // 4. Jev reads chats that changed since it last read them.
      let read = 0
      let jevProblems = 0
      if (jevKey) {
        const { data: toRead } = await db.from('prospects')
          .select('contact_id, last_message_at, ai_read_until, ai_version')
          .eq('source', 'ghl').eq('hidden', false).gt('message_count', 0)
          .order('last_message_at', { ascending: false }).limit(1000)
        const due = (toRead ?? []).filter((p) => p.ai_version !== PROSPECT_VERSION || time(p.last_message_at) > time(p.ai_read_until)).slice(0, MAX_JEV)
        const today = now.toISOString().slice(0, 10)
        await pool(due, 4, async (p) => {
          try {
            const { data: msgs } = await db.from('prospect_messages').select('direction, body, type, at')
              .eq('contact_id', p.contact_id).order('at', { ascending: false }).limit(40)
            const transcript = chatTranscript((msgs ?? []) as ChatMessage[])
            const stamp = { ai_version: PROSPECT_VERSION, ai_at: now.toISOString(), ai_read_until: p.last_message_at }
            if (!transcript) { await db.from('prospects').update(stamp).eq('contact_id', p.contact_id); return }
            const a = parseProspectAnswer(await askJev(prospectJevRequest(transcript, today, JEV_MODEL)))
            await db.from('prospects').update({
              ...stamp, ai_kind: a.kind, ai_industry: a.industry, ai_temperature: a.temperature, ai_confidence: a.confidence,
            }).eq('contact_id', p.contact_id)
            read++
          } catch (err) {
            if (err instanceof Stop) throw err
            jevProblems++
            firstProblem ??= (err as Error).message
          }
        })
      }

      return {
        rows: rows.length,
        partial: messageProblems + jevProblems > 0,
        details: {
          chats: chats.length, prospects: rows.length, leftOut: skipped, opportunities: oppByContact.size,
          messagesRead, messageProblems, readByJev: read, jevProblems, jev: jevKey ? 'on' : 'TYPESAFE_API_KEY not set', firstProblem,
        },
      }
    })
    return json(result)
  } catch (err) {
    return json({ error: (err as Error).message }, err instanceof Stop ? 502 : 500)
  }
})
