/**
 * meta-action — "Turn off" on a suggestion: pauses the ad in Meta
 * (docs/suggestions.md#turn-off-safety). Called from the app by a signed-in
 * employee with their login (Supabase checks the login before this runs).
 *
 * Safety, in order:
 *  1. The caller must be an active employee (me()).
 *  2. They must be allowed to see the suggestion (row-level security: their own
 *     accounts, or everyone's for owners/admins) and it must still be open.
 *  3. Re-read the ad from Meta. Already paused → mark done, change nothing.
 *  4. Pause it with the system user token.
 *  5. Record it in actions_log (who, before/after, result) and mark the
 *     suggestion done. Failures are logged too.
 *
 * Secrets: META_SYSTEM_USER_TOKEN. Provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { corsHeaders, json } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/supabase.ts'

const GRAPH = 'https://graph.facebook.com/v23.0'

async function meta(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('META_SYSTEM_USER_TOKEN')
  if (!token) throw new Error('META_SYSTEM_USER_TOKEN not set')
  const res = await fetch(`${GRAPH}/${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, body }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const user = userClient(req.headers.get('Authorization'))
  const db = serviceClient()

  // 1. Who is asking?
  const { data: me } = await user.rpc('me')
  if (!me?.id) return json({ error: 'Not signed in as an MRKD employee.' }, 403)

  const { suggestionId } = await req.json().catch(() => ({}))
  if (!suggestionId) return json({ error: 'suggestionId is required.' }, 400)

  // 2. Can they see it (RLS), and is it still open?
  const { data: sug } = await user.from('suggestions').select('id, status, action, entity_id, entity_name, account_id').eq('id', suggestionId).maybeSingle()
  if (!sug) return json({ error: 'Suggestion not found, or it belongs to another ads manager.' }, 404)
  if (!['open', 'snoozed'].includes(sug.status)) return json({ error: `This suggestion is already ${sug.status}.` }, 409)
  const action = sug.action as { type?: string; adId?: string }
  if (action?.type !== 'pause_ad' || !action.adId) return json({ error: 'This suggestion has no ad to turn off.' }, 400)
  const adId = action.adId

  const log = (result: 'ok' | 'error', before: unknown, after: unknown, error?: string) =>
    db.from('actions_log').insert({
      actor_id: me.id, action: 'meta.pause_ad', target_type: 'meta_ad', target_id: adId, ad_id: adId,
      before, after, result, error: error ?? null,
    })
  const markDone = () =>
    db.from('suggestions').update({ status: 'done', acted_by: me.id, acted_at: new Date().toISOString() }).eq('id', sug.id)

  // 3. Current state in Meta.
  const current = await meta(`${adId}?fields=id,name,status,effective_status`)
  if (!current.ok) {
    const msg = current.body?.error?.message ?? 'Meta did not return the ad.'
    await log('error', null, null, msg)
    return json({ error: `Couldn't read the ad from Meta: ${msg}` }, 502)
  }
  const before = { status: current.body.status, effective_status: current.body.effective_status }
  if (current.body.status !== 'ACTIVE') {
    await markDone()
    await log('ok', before, before, 'already not active; nothing changed')
    return json({ ok: true, alreadyOff: true, message: `${sug.entity_name ?? 'The ad'} was already off.` })
  }

  // 4. Pause it.
  const paused = await meta(adId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'PAUSED' }),
  })
  if (!paused.ok || paused.body?.success === false) {
    const e = paused.body?.error ?? {}
    const permission = [10, 200, 294].includes(e.code) || /permission/i.test(e.message ?? '')
    const msg = permission
      ? 'This ad account only lets The Lab view, not change ads. In Business settings, give MRKDPlatformTools "Manage campaigns" on this account, then try again.'
      : `Meta refused: ${e.message ?? 'unknown error'}`
    await log('error', before, null, e.message ?? 'unknown error')
    return json({ error: msg, needsManageCampaigns: permission }, permission ? 403 : 502)
  }

  // 5. Record it.
  await db.from('meta_ads').update({ status: 'PAUSED', effective_status: 'PAUSED' }).eq('id', adId)
  await markDone()
  await log('ok', before, { status: 'PAUSED' })
  return json({ ok: true, message: `${sug.entity_name ?? 'The ad'} is now off in Meta.` })
})
