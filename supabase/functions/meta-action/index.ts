/**
 * meta-action — "Turn off" on a suggestion: pauses the ad in Meta
 * (docs/suggestions.md#turn-off-safety). Called from the app by a signed-in
 * employee with their login (Supabase checks the login before this runs).
 *
 * Also "Undo" ({ suggestionId, undo: true }): turns the same ad back on within
 * 24 hours of a Turn off made from The Lab, if it's still paused. Logged too.
 *
 * Safety, in order:
 *  1. The caller must be an active employee (me()).
 *  2. They must be allowed to see the suggestion (row-level security: their own
 *     accounts, or everyone's for owners/admins) and it must still be open.
 *  3. Re-read the ad from Meta. Already paused → mark done, change nothing.
 *  4. Pause it with the system user token.
 *  5. Read the ad back from Meta to confirm it really is paused (the answer
 *     says "confirmed" only then).
 *  6. Record it in actions_log (who, before/after, result) and mark the
 *     suggestion done. Failures are logged too.
 *
 * Secrets: META_SYSTEM_USER_TOKEN. Provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { corsHeaders, json } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/supabase.ts'

const GRAPH = 'https://graph.facebook.com/v23.0'

/** Ask Meta for the ad's status right after a change, to confirm it took. */
async function confirmStatus(adId: string, want: 'PAUSED' | 'ACTIVE') {
  const r = await meta(`${adId}?fields=status,effective_status`)
  const status = r.ok ? String(r.body.status ?? '') : null
  return { verified: status === want, metaStatus: status, effectiveStatus: r.ok ? (r.body.effective_status ?? null) : null }
}

type MetaError = { message?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string }

/** Everything Meta said, for the log (so the next problem is easy to diagnose). */
const metaErrorDetail = (e: MetaError) =>
  [e.error_user_title, e.error_user_msg, e.message, `code ${e.code ?? '?'}/${e.error_subcode ?? '-'}`, e.fbtrace_id && `trace ${e.fbtrace_id}`].filter(Boolean).join(' | ')

/** Plain-English reason, and what kind of access is missing. */
function explainMetaError(e: MetaError): { kind: 'account' | 'page' | null; message: string } {
  // Lead ads: Meta re-checks the whole ad on any change; if The Lab can't see the client's Page,
  // it can't see the instant form and says the form is missing (code 100 / 3390001).
  if (e.error_subcode === 3390001 || /lead form/i.test(e.error_user_title ?? '')) {
    return { kind: 'page', message: "Meta won't let The Lab change this lead ad: The Lab can't see this client's Facebook Page, so Meta thinks the instant form is missing. Turn it off in Ads Manager for now. To fix it for good, give MRKDPlatformTools access to the client's Page (docs/setup/meta.md, Pages)." }
  }
  if ([10, 200, 294].includes(e.code ?? 0) || /permission/i.test(e.message ?? '')) {
    return { kind: 'account', message: 'This ad account only lets The Lab view, not change ads. In Business settings, give MRKDPlatformTools "Manage campaigns" on this account, then try again. Until then, turn it off in Ads Manager.' }
  }
  return { kind: null, message: `Meta refused: ${e.error_user_msg ?? e.message ?? 'unknown error'}${e.error_user_title ? ` (${e.error_user_title})` : ''}. Turn it off in Ads Manager.` }
}

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

  const { suggestionId, undo } = await req.json().catch(() => ({}))
  if (!suggestionId) return json({ error: 'suggestionId is required.' }, 400)

  // 2. Can they see it (RLS), and is it in the right state?
  const { data: sug } = await user.from('suggestions').select('id, status, level, action, entity_id, entity_name, account_id').eq('id', suggestionId).maybeSingle()
  if (!sug) return json({ error: 'Suggestion not found, or it belongs to another ads manager.' }, 404)
  // Any ad-level suggestion can be turned off (Today screen details), not only pause_ad ones.
  const action = sug.action as { type?: string; adId?: string }
  const adId = action?.adId
  if (sug.level !== 'ad' || !adId) return json({ error: 'This suggestion has no ad to turn off.' }, 400)
  if (undo) {
    if (sug.status !== 'done') return json({ error: 'There is nothing to undo for this suggestion.' }, 409)
  } else if (!['open', 'snoozed'].includes(sug.status)) {
    return json({ error: `This suggestion is already ${sug.status}.` }, 409)
  }

  const log = (result: 'ok' | 'error', before: unknown, after: unknown, error?: string) =>
    db.from('actions_log').insert({
      actor_id: me.id, action: undo ? 'meta.resume_ad' : 'meta.pause_ad', target_type: 'meta_ad', target_id: adId, ad_id: adId,
      before, after: after && typeof after === 'object' ? { ...after, suggestionId: sug.id } : { suggestionId: sug.id },
      result, error: error ?? null,
    })

  if (undo) {
    // Only a Turn off made from The Lab in the last 24 hours, and only if the ad is still paused.
    const { data: last } = await db.from('actions_log').select('created_at, result, after')
      .eq('action', 'meta.pause_ad').eq('ad_id', adId).eq('result', 'ok')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!last || Date.now() - new Date(last.created_at).getTime() > 24 * 3_600_000) {
      return json({ error: 'Undo is only possible within 24 hours of turning it off here. Turn it back on in Ads Manager.' }, 409)
    }
    const now = await meta(`${adId}?fields=id,status,effective_status`)
    if (!now.ok) return json({ error: `Couldn't read the ad from Meta: ${now.body?.error?.message ?? 'unknown error'}` }, 502)
    if (now.body.status !== 'PAUSED') {
      return json({ error: `The ad isn't paused any more (it's ${String(now.body.status).toLowerCase()}), so there's nothing to undo.` }, 409)
    }
    const on = await meta(adId, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ status: 'ACTIVE' }),
    })
    if (!on.ok || on.body?.success === false) {
      const e = on.body?.error ?? {}
      await log('error', { status: 'PAUSED' }, null, metaErrorDetail(e))
      return json({ error: explainMetaError(e).message.replace('Turn it off in Ads Manager', 'Turn it back on in Ads Manager') }, 502)
    }
    const check = await confirmStatus(adId, 'ACTIVE')
    await db.from('meta_ads').update({ status: 'ACTIVE' }).eq('id', adId)
    // Undone on purpose: don't suggest it again for 7 days (same as Dismiss).
    await db.from('suggestions').update({ status: 'dismissed', acted_by: me.id, acted_at: new Date().toISOString() }).eq('id', sug.id)
    await log('ok', { status: 'PAUSED' }, { status: 'ACTIVE', confirmed: check.verified })
    return json({
      ok: true, verified: check.verified, metaStatus: check.metaStatus, at: new Date().toISOString(),
      message: check.verified
        ? `${sug.entity_name ?? 'The ad'} is back on. Meta confirms it's active.`
        : `Meta accepted the change, but still shows ${sug.entity_name ?? 'the ad'} as ${String(check.metaStatus ?? 'unknown').toLowerCase()}. Check in Ads Manager.`,
    })
  }
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
    return json({ ok: true, alreadyOff: true, verified: true, metaStatus: current.body.status, at: new Date().toISOString(),
      message: `${sug.entity_name ?? 'The ad'} was already off in Meta (${String(current.body.status).toLowerCase()}). Nothing was changed.` })
  }

  // 4. Pause it.
  const paused = await meta(adId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ status: 'PAUSED' }),
  })
  if (!paused.ok || paused.body?.success === false) {
    const e = paused.body?.error ?? {}
    const why = explainMetaError(e)
    await log('error', before, null, metaErrorDetail(e))
    return json({ error: why.message, needsManageCampaigns: why.kind === 'account', needsPageAccess: why.kind === 'page' }, why.kind ? 403 : 502)
  }

  // 5. Confirm with Meta, then record it.
  const check = await confirmStatus(adId, 'PAUSED')
  await db.from('meta_ads').update({ status: 'PAUSED', effective_status: 'PAUSED' }).eq('id', adId)
  await markDone()
  await log('ok', before, { status: 'PAUSED', confirmed: check.verified })
  return json({
    ok: true, verified: check.verified, metaStatus: check.metaStatus, at: new Date().toISOString(),
    message: check.verified
      ? `${sug.entity_name ?? 'The ad'} is off. Meta confirms it's paused.`
      : `Meta accepted the change, but still shows ${sug.entity_name ?? 'the ad'} as ${String(check.metaStatus ?? 'unknown').toLowerCase()}. Check in Ads Manager.`,
  })
})
