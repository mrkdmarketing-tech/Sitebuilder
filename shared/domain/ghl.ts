/**
 * Reading GHL contacts (docs/ghl.md). A client is a contact in MRKD's GHL
 * sub-account; its status and client number are custom fields.
 */
export const GHL_API = 'https://services.leadconnectorhq.com'
export const GHL_VERSION = '2021-07-28'
/** MRKD's own GHL sub-account: every client is a contact here (from the Retool copy, Nov 2026). */
export const MRKD_LOCATION_ID = '1Pbw0cdWjFMBsIFPrA0d'

export interface GhlContactSummary {
  contactId: string
  locationId: string
  clientId: number | null
  name: string | null
  clientStatus: string | null
  assignedTo: string | null
}

type Raw = Record<string, unknown>

/** The fields The Lab uses, from GET /contacts/{id} ({ contact: {...} } or the contact itself). */
export function summariseContact(raw: unknown, fields: { status?: string | null; clientId?: string | null }): GhlContactSummary | null {
  const c = ((raw as Raw)?.contact ?? raw) as Raw | null
  if (!c || typeof c.id !== 'string') return null
  const custom = Array.isArray(c.customFields) ? (c.customFields as { id?: string; value?: unknown; field_value?: unknown }[]) : []
  const valueOf = (id?: string | null) => {
    if (!id) return null
    const f = custom.find((x) => x.id === id)
    const v = f?.value ?? f?.field_value
    return v === undefined || v === null || v === '' ? null : v
  }
  const idValue = valueOf(fields.clientId)
  const clientId = idValue === null ? null : Number(idValue)
  const name = [c.companyName, c.contactName ?? [c.firstName, c.lastName].filter(Boolean).join(' ')].find((x) => typeof x === 'string' && x.trim()) as string | undefined
  const status = valueOf(fields.status)
  return {
    contactId: c.id,
    locationId: String(c.locationId ?? ''),
    clientId: Number.isFinite(clientId) ? clientId : null,
    name: name?.trim() ?? null,
    clientStatus: typeof status === 'string' ? status : status === null ? null : String(status),
    assignedTo: typeof c.assignedTo === 'string' && c.assignedTo ? c.assignedTo : null,
  }
}

/** Plain-English reason for a refused GHL request. */
export function explainGhlError(status: number, path: string, body: string): string {
  if (status === 401) return `GHL refused the token (401). Check GHL_PRIVATE_TOKEN is the private integration token from MRKD's sub-account.`
  if (status === 403) return `GHL says the token isn't allowed to read ${path} (403). Edit the private integration in GHL and tick the matching "View" permission.`
  if (status === 429) return 'GHL rate limit reached (429). The next run will try again.'
  return `GHL ${status} on ${path}: ${body.slice(0, 200)}`
}
