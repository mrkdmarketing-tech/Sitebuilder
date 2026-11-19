/**
 * ghl-sync: reads MRKD's GHL sub-account directly, read-only (docs/ghl.md).
 *
 *  - Users (the team): GET /users/?locationId=...
 *  - Each client's contact: GET /contacts/{id} for every client The Lab knows
 *    (Client Status and Client ID custom fields, "assigned to" = ads manager).
 *  - Every contact with a Client Status (POST /contacts/search): clients that
 *    exist only in GHL (Active/New/Paused and assigned to a team member) are
 *    added to The Lab (add_ghl_clients, migration 3600).
 *
 * Saves what it reads in ghl_users_live and ghl_contacts_live, then
 * apply_ghl_live() makes client status and ads manager follow GHL (Lab changes
 * still win; migration 3500). Never writes to GHL (view-only permissions).
 *
 * Scheduled hourly with the cron secret (migration 3200). Secrets:
 * GHL_PRIVATE_TOKEN (private integration token from MRKD's sub-account),
 * optional GHL_LOCATION_ID (defaults to MRKD's).
 */
import { GHL_API, GHL_VERSION, MRKD_LOCATION_ID, explainGhlError, summariseContact } from '../../../shared/domain/ghl.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'

class Stop extends Error {}

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const token = Deno.env.get('GHL_PRIVATE_TOKEN')
  const location = Deno.env.get('GHL_LOCATION_ID') ?? MRKD_LOCATION_ID
  const db = serviceClient()

  const ghl = async (path: string): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${GHL_API}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json' },
      })
      if (res.ok) return res.json()
      const body = await res.text()
      if (res.status === 429 && attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue }
      const msg = explainGhlError(res.status, path.split('?')[0], body)
      if (res.status === 401 || res.status === 403) throw new Stop(msg)
      throw new Error(msg)
    }
  }

  // ?probe=access: which parts of GHL the token can read (status codes and counts only; no names or messages).
  if (new URL(req.url).searchParams.get('probe') === 'access' && token) {
    const h = { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json' }
    const get = async (path: string) => {
      const res = await fetch(`${GHL_API}${path}`, { headers: h })
      return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, unknown> }
    }
    const conv = await get(`/conversations/search?locationId=${location}&limit=50`)
    const convs = (conv.body.conversations ?? []) as { id: string; type?: string; lastMessageType?: string }[]
    const types: Record<string, number> = {}
    for (const c of convs) { const t = c.lastMessageType ?? c.type ?? 'unknown'; types[t] = (types[t] ?? 0) + 1 }
    const msgs = convs[0] ? await get(`/conversations/${convs[0].id}/messages?limit=1`) : null
    const pipes = await get(`/opportunities/pipelines?locationId=${location}`)
    const opps = await get(`/opportunities/search?location_id=${location}&limit=1`)
    return json({
      conversations: { status: conv.status, total: conv.body.total ?? null, lastMessageTypesInLatest50: types },
      messages: msgs ? { status: msgs.status } : null,
      pipelines: { status: pipes.status, pipelines: ((pipes.body.pipelines ?? []) as { name: string; stages?: { name: string }[] }[]).map((p) => ({ name: p.name, stages: (p.stages ?? []).map((s) => s.name) })) },
      opportunities: { status: opps.status, total: (opps.body.meta as { total?: number } | undefined)?.total ?? null },
    })
  }

  // ?search=<text>: find contacts in MRKD's sub-account (read-only diagnostic, e.g. a new client not in Retool yet).
  const search = new URL(req.url).searchParams.get('search')
  if (search && token) {
    try {
      const res = await fetch(`${GHL_API}/contacts/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(search === '*'
          ? { locationId: location, pageLimit: 1 }
          : search === 'has-status'
            ? { locationId: location, pageLimit: 100, filters: [{ field: 'customFields.Qukwm5t43UFGbdfB3ZAE', operator: 'exists' }] }
            : { locationId: location, pageLimit: 20, query: search.slice(0, 80) }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return json({ error: explainGhlError(res.status, '/contacts/search', JSON.stringify(body)) }, 502)
      const { data: fieldRows } = await db.from('ghl_custom_fields').select('id, field_key').in('field_key', ['contact.client_status', 'contact.client_id'])
      const fields = {
        status: fieldRows?.find((f) => f.field_key === 'contact.client_status')?.id ?? null,
        clientId: fieldRows?.find((f) => f.field_key === 'contact.client_id')?.id ?? null,
      }
      return json({ total: body.total ?? null, contacts: (body.contacts ?? []).map((c: unknown) => summariseContact(c, fields)) })
    } catch (err) {
      return json({ error: (err as Error).message }, 500)
    }
  }

  try {
    const result = await logRun(db, 'ghl.sync', async () => {
      if (!token) return { rows: 0, details: { skipped: 'GHL_PRIVATE_TOKEN is not set.' } }
      const now = new Date().toISOString()

      // 1. Users
      const usersRaw = await ghl(`/users/?locationId=${encodeURIComponent(location)}`) as { users?: Record<string, unknown>[] }
      const users = (usersRaw.users ?? []).map((u) => ({
        id: String(u.id), name: (u.name as string) ?? [u.firstName, u.lastName].filter(Boolean).join(' '),
        email: (u.email as string) ?? null, data: u, fetched_at: now,
      }))
      if (users.length) {
        const { error } = await db.from('ghl_users_live').upsert(users)
        if (error) throw new Error(error.message)
      }

      // 2. Client contacts (the ones The Lab knows through the Retool copy)
      const { data: fieldRows } = await db.from('ghl_custom_fields').select('id, field_key').in('field_key', ['contact.client_status', 'contact.client_id'])
      const fields = {
        status: fieldRows?.find((f) => f.field_key === 'contact.client_status')?.id ?? null,
        clientId: fieldRows?.find((f) => f.field_key === 'contact.client_id')?.id ?? null,
      }
      const { data: clients, error: cErr } = await db.from('clients').select('ghl_contact_id').not('ghl_contact_id', 'is', null)
      if (cErr) throw new Error(cErr.message)
      const ids = [...new Set((clients ?? []).map((c) => c.ghl_contact_id as string))]

      let saved = 0, missing = 0, failed = 0
      let firstProblem: string | null = null
      const queue = [...ids]
      const worker = async () => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          try {
            const raw = await ghl(`/contacts/${encodeURIComponent(id)}`)
            const s = summariseContact(raw, fields)
            if (!s) { missing++; continue }
            const { error } = await db.from('ghl_contacts_live').upsert({
              contact_id: s.contactId, location_id: s.locationId || location, client_id: s.clientId, name: s.name,
              client_status: s.clientStatus, assigned_to: s.assignedTo, data: (raw as { contact?: unknown }).contact ?? raw, fetched_at: now,
            })
            if (error) throw new Error(error.message)
            saved++
          } catch (err) {
            if (err instanceof Stop) throw err
            if (/GHL 404|GHL 400/.test((err as Error).message)) missing++
            else failed++
            firstProblem ??= (err as Error).message
          }
        }
      }
      // GHL allows 100 requests per 10 seconds per sub-account; 4 at a time stays well under.
      await Promise.all(Array.from({ length: 4 }, worker))

      // 3. Every contact with a Client Status: find clients that exist only in GHL.
      const known = new Set(ids)
      const found: ReturnType<typeof summariseContact>[] = []
      const raws = new Map<string, unknown>()
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(`${GHL_API}/contacts/search`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Version: GHL_VERSION, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: location, pageLimit: 100, page, filters: fields.status ? [{ field: `customFields.${fields.status}`, operator: 'exists' }] : [] }),
        })
        if (!res.ok) { firstProblem ??= explainGhlError(res.status, '/contacts/search', await res.text()); break }
        const body = await res.json() as { contacts?: unknown[]; total?: number }
        for (const c of body.contacts ?? []) {
          const s = summariseContact(c, fields)
          if (s) { found.push(s); raws.set(s.contactId, c) }
        }
        if (!body.contacts?.length || found.length >= (body.total ?? 0)) break
      }
      const ghlOnly = found.filter((s) => s && !known.has(s.contactId))
      for (const s of ghlOnly) {
        if (!s) continue
        await db.from('ghl_contacts_live').upsert({
          contact_id: s.contactId, location_id: s.locationId || location, client_id: s.clientId, name: s.name,
          client_status: s.clientStatus, assigned_to: s.assignedTo, data: raws.get(s.contactId) ?? {}, fetched_at: now,
        })
      }
      const team = new Set(users.map((u) => u.id))
      // A business (company name set), assigned to a team member, with a live status.
      // Contacts that are just a person or an email (e.g. old billing contacts) are left out.
      const raw = (id: string) => (raws.get(id) ?? {}) as { companyName?: string; city?: string; website?: string }
      const toAdd = ghlOnly.filter((s) => s && s.assignedTo && team.has(s.assignedTo) && ['Active', 'New', 'Paused'].includes(s.clientStatus ?? '')
          && (raw(s.contactId).companyName ?? '').trim())
        .map((s) => {
          const r = raw(s!.contactId)
          return { contactId: s!.contactId, name: r.companyName!.trim(), status: s!.clientStatus, assignedTo: s!.assignedTo, city: r.city ?? null, website: r.website ?? null }
        })
      const { data: added, error: addErr } = await db.rpc('add_ghl_clients', { p: toAdd })
      if (addErr) throw new Error(addErr.message)

      // 4. Status and ads manager follow GHL (Lab changes still win).
      const { data: applied, error: applyErr } = await db.rpc('apply_ghl_live')
      if (applyErr) throw new Error(applyErr.message)
      const { data: diff } = await db.rpc('ghl_compare')
      return {
        rows: saved, partial: missing + failed > 0,
        details: {
          users: users.length, contacts: ids.length, saved, missing, failed, firstProblem, differences: (diff ?? []).length,
          withStatusInGhl: found.length, ghlOnly: ghlOnly.length, added, applied,
        },
      }
    })
    return json(result)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
