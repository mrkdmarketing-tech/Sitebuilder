/**
 * prospects-action: owner actions on Prospects that need GHL (docs/prospects.md).
 * Called from the Prospects screen with the signed-in owner's session; refused
 * for anyone who isn't an owner with two-step sign-in (is_owner()).
 *
 *   { action: 'search', query }   find contacts in MRKD's GHL sub-account
 *   { action: 'add', contactId }  put a GHL contact on the board: reads the
 *                                 contact, its latest chat (40 messages) and
 *                                 sales opportunity, and asks Jev to read the chat
 *
 * Read-only with GHL. Secrets: GHL_PRIVATE_TOKEN, TYPESAFE_API_KEY (optional).
 */
import { GHL_API, GHL_VERSION, MRKD_LOCATION_ID, explainGhlError } from '../../../shared/domain/ghl.ts'
import {
  NOT_SALES_PIPELINES, PROSPECT_VERSION, chatTranscript, parseProspectAnswer, prospectJevRequest, type ChatMessage,
} from '../../../shared/domain/prospects.ts'
import { corsHeaders, isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/supabase.ts'

type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)
const iso = (v: unknown) => {
  const n = num(v)
  const d = n != null ? new Date(n) : typeof v === 'string' ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}
const CHANNELS: Record<string, string> = {
  TYPE_SMS: 'SMS', TYPE_EMAIL: 'Email', TYPE_FACEBOOK: 'Facebook', TYPE_INSTAGRAM: 'Instagram', TYPE_CALL: 'Call', TYPE_WHATSAPP: 'WhatsApp',
}
const channelOf = (t: unknown) => (typeof t === 'string' ? CHANNELS[t] ?? t.replace(/^TYPE_/, '').replace(/_/g, ' ').toLowerCase() : null)
const nameOf = (c: Obj) => str(c.contactName) ?? str(c.name) ?? ([str(c.firstName), str(c.lastName)].filter(Boolean).join(' ') || null)
  ?? str(c.companyName) ?? str(c.email) ?? str(c.phone) ?? 'Unknown'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // An owner with two-step sign-in, or the server itself (cron secret, never in the browser; used by checks).
  let meId: string | null = null
  if (!isAuthorisedCron(req)) {
    const user = userClient(req.headers.get('Authorization'))
    const { data: owner } = await user.rpc('is_owner')
    if (owner !== true) return json({ error: 'Only owners (with two-step sign-in) can do this.' }, 403)
    meId = ((await user.rpc('current_employee_id')).data as string | null) ?? null
  }

  const token = Deno.env.get('GHL_PRIVATE_TOKEN')
  if (!token) return json({ error: 'GHL is not connected (GHL_PRIVATE_TOKEN).' }, 500)
  const location = Deno.env.get('GHL_LOCATION_ID') ?? MRKD_LOCATION_ID
  const db = serviceClient()
  const ghl = async (path: string, body?: unknown): Promise<Obj> => {
    const res = await fetch(`${GHL_API}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(explainGhlError(res.status, path.split('?')[0], await res.text()))
    return await res.json() as Obj
  }

  let input: { action?: string; query?: string; contactId?: string }
  try { input = await req.json() } catch { return json({ error: 'Bad request.' }, 400) }

  try {
    if (input.action === 'search') {
      const query = (input.query ?? '').trim().slice(0, 80)
      if (query.length < 2) return json({ results: [] })
      const body = await ghl('/contacts/search', { locationId: location, pageLimit: 15, query })
      const contacts = (body.contacts ?? []) as Obj[]
      const ids = contacts.map((c) => String(c.id))
      const [{ data: rows }, { data: clients }, { data: statuses }] = await Promise.all([
        db.from('prospects').select('contact_id, hidden, ai_kind, stage, value, industry, temperature, source').in('contact_id', ids),
        db.from('clients').select('ghl_contact_id').in('ghl_contact_id', ids),
        db.from('ghl_contacts_live').select('contact_id').in('contact_id', ids).not('client_status', 'is', null),
      ])
      const byId = new Map((rows ?? []).map((r) => [r.contact_id as string, r]))
      const clientIds = new Set([...(clients ?? []).map((c) => c.ghl_contact_id), ...(statuses ?? []).map((s) => s.contact_id)])
      return json({
        results: contacts.map((c) => {
          const id = String(c.id)
          const r = byId.get(id)
          const listed = r && !r.hidden && (r.ai_kind === 'prospect' || r.stage != null || r.value != null || r.industry != null || r.temperature != null)
          return {
            contactId: id, name: nameOf(c), company: str(c.companyName), email: str(c.email), phone: str(c.phone),
            state: listed ? 'on_board' : r?.hidden ? 'removed' : clientIds.has(id) ? 'client' : 'new',
          }
        }),
      })
    }

    if (input.action === 'add') {
      const contactId = str(input.contactId)
      if (!contactId || !/^[A-Za-z0-9_-]{6,64}$/.test(contactId)) return json({ error: 'Bad contact.' }, 400)
      const contact = ((await ghl(`/contacts/${contactId}`)).contact ?? {}) as Obj
      if (!contact.id) return json({ error: 'That contact was not found in GHL.' }, 404)

      // Latest chat and sales opportunity.
      const convs = ((await ghl(`/conversations/search?locationId=${location}&contactId=${contactId}&limit=5&sortBy=last_message_date&sort=desc`)).conversations ?? []) as Obj[]
      const conv = convs[0]
      let opp: { pipeline: string; stage: string | null; value: number | null } | null = null
      try {
        const pipes = await ghl(`/opportunities/pipelines?locationId=${location}`)
        const pipelineName = new Map<string, string>(); const stageName = new Map<string, string>()
        for (const p of (pipes.pipelines ?? []) as Obj[]) {
          pipelineName.set(String(p.id), String(p.name ?? ''))
          for (const s of (p.stages ?? []) as Obj[]) stageName.set(String(s.id), String(s.name ?? ''))
        }
        const opps = ((await ghl(`/opportunities/search?location_id=${location}&contact_id=${contactId}&limit=20`)).opportunities ?? []) as Obj[]
        const sales = opps.map((o) => ({ o, pipeline: pipelineName.get(String(o.pipelineId)) ?? '' })).filter((x) => !NOT_SALES_PIPELINES.test(x.pipeline))
          .sort((a, b) => String(b.o.updatedAt ?? '').localeCompare(String(a.o.updatedAt ?? '')))
        if (sales[0]) opp = { pipeline: sales[0].pipeline, stage: stageName.get(String(sales[0].o.pipelineStageId)) ?? null, value: num(sales[0].o.monetaryValue) }
      } catch { /* pipelines are a nice-to-have */ }

      const { data: existing } = await db.from('prospects').select('stage').eq('contact_id', contactId).maybeSingle()
      const now = new Date().toISOString()
      const { error: upErr } = await db.from('prospects').upsert({
        contact_id: contactId, source: 'ghl', name: nameOf(contact).slice(0, 200), company: str(contact.companyName)?.slice(0, 200) ?? null,
        email: str(contact.email), phone: str(contact.phone),
        tags: Array.isArray(contact.tags) ? (contact.tags as unknown[]).filter((t) => typeof t === 'string') : [],
        channel: conv ? channelOf(conv.lastMessageType ?? conv.type) : null,
        last_message_at: conv ? iso(conv.lastMessageDate) : null,
        last_from: conv?.lastMessageDirection === 'inbound' ? 'them' : conv?.lastMessageDirection === 'outbound' ? 'us' : null,
        last_preview: conv ? str(conv.lastMessageBody)?.slice(0, 200) ?? null : null,
        ghl_pipeline: opp?.pipeline ?? null, ghl_stage: opp?.stage ?? null, ghl_value: opp?.value ?? null,
        hidden: false, stage: existing?.stage ?? 'new', synced_at: now, updated_at: now, updated_by: meId ?? null,
      })
      if (upErr) throw new Error(upErr.message)

      let messages = 0
      if (conv) {
        const inner = ((await ghl(`/conversations/${conv.id}/messages?limit=40`)).messages ?? {}) as Obj
        const list = (Array.isArray(inner) ? inner : (inner.messages ?? [])) as Obj[]
        const rows = list.map((m) => ({
          message_id: String(m.id), contact_id: contactId, direction: m.direction === 'inbound' ? 'inbound' : 'outbound',
          type: str(m.messageType), body: str(m.body)?.slice(0, 4000) ?? null, at: iso(m.dateAdded) ?? now,
        })).filter((m) => m.message_id && m.message_id !== 'undefined')
        if (rows.length) {
          const { error } = await db.from('prospect_messages').upsert(rows)
          if (error) throw new Error(error.message)
        }
        messages = rows.length
        await db.from('prospects').update({ message_count: rows.length }).eq('contact_id', contactId)

        const key = Deno.env.get('TYPESAFE_API_KEY')
        const transcript = chatTranscript(rows as ChatMessage[])
        if (key && transcript) {
          const res = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(prospectJevRequest(transcript, now.slice(0, 10), Deno.env.get('JEV_MODEL') ?? 'jev-latest')),
          })
          if (res.ok) {
            const a = parseProspectAnswer(await res.json())
            await db.from('prospects').update({
              ai_kind: a.kind, ai_industry: a.industry, ai_temperature: a.temperature, ai_confidence: a.confidence,
              ai_version: PROSPECT_VERSION, ai_at: now, ai_read_until: iso(conv.lastMessageDate),
            }).eq('contact_id', contactId)
          }
        }
      }
      return json({ ok: true, name: nameOf(contact), messages })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 502)
  }
})
