/**
 * ghl-sync: reads MRKD's GHL sub-account directly, read-only (docs/ghl.md).
 *
 *  - Users (the team): GET /users/?locationId=...
 *  - Each client's contact: GET /contacts/{id} for every client The Lab knows
 *    (Client Status and Client ID custom fields, "assigned to" = ads manager).
 *
 * Saves what it reads in ghl_users_live and ghl_contacts_live. The Lab still
 * uses the Retool copy; ghl_compare() lists differences until we switch over.
 * Never writes to GHL (no write permissions are asked for).
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

      const { data: diff } = await db.rpc('ghl_compare')
      return {
        rows: saved, partial: missing + failed > 0,
        details: { users: users.length, contacts: ids.length, saved, missing, failed, firstProblem, differences: (diff ?? []).length },
      }
    })
    return json(result)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
