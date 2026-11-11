/**
 * meta-check — reports what the Meta system user token is allowed to do
 * (its granted scopes), without ever returning the token. Admin diagnostic,
 * called with the cron secret. docs/background-jobs.md
 *
 * ?ad=<id>: explains why an ad can't be paused (Meta validates a pause without
 * doing it).
 */
import { isAuthorisedCron, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const token = Deno.env.get('META_SYSTEM_USER_TOKEN')
  if (!token) return json({ error: 'META_SYSTEM_USER_TOKEN not set' }, 500)
  // ?ads=<id>,<id>...: can each of these ads be paused? (validate only, nothing changes) + which Pages The Lab can see.
  const adsParam = new URL(req.url).searchParams.get('ads')
  if (adsParam) {
    const auth = { Authorization: `Bearer ${token}` }
    const ids = adsParam.split(',').filter((x) => /^\d+$/.test(x)).slice(0, 100)
    const results = []
    for (const id of ids) {
      const r = await fetch(`https://graph.facebook.com/v23.0/${id}`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'PAUSED', execution_options: '["validate_only"]' }),
      })
      const b = await r.json().catch(() => ({}))
      results.push({ id, ok: r.ok, code: b.error?.code ?? null, subcode: b.error?.error_subcode ?? null, title: b.error?.error_user_title ?? b.error?.message ?? null })
    }
    const pages = await (await fetch('https://graph.facebook.com/v23.0/me/accounts?fields=id,name,tasks&limit=500', { headers: auth })).json().catch(() => ({}))
    return json({ results, pages: (pages.data ?? []).map((p: { id: string; name: string; tasks?: string[] }) => ({ id: p.id, name: p.name, tasks: p.tasks ?? [] })), pagesError: pages.error?.message ?? null })
  }

  // ?adsets=<id>,<id>...: can these ad sets be paused? (validate only)
  const adsetsParam = new URL(req.url).searchParams.get('adsets')
  if (adsetsParam) {
    const auth = { Authorization: `Bearer ${token}` }
    const results = []
    for (const id of adsetsParam.split(',').filter((x) => /^\d+$/.test(x)).slice(0, 50)) {
      const r = await fetch(`https://graph.facebook.com/v23.0/${id}`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: 'PAUSED', execution_options: '["validate_only"]' }),
      })
      const b = await r.json().catch(() => ({}))
      results.push({ id, ok: r.ok, subcode: b.error?.error_subcode ?? null, title: b.error?.error_user_title ?? b.error?.message ?? null })
    }
    return json({ results })
  }

  // ?ad=<id>: why can't this ad be paused? Reads the ad and asks Meta to *validate* a pause
  // (execution_options=validate_only: Meta checks it and changes nothing).
  const adParam = new URL(req.url).searchParams.get('ad')
  if (adParam) {
    if (!/^\d+$/.test(adParam)) return json({ error: 'bad ad id' }, 400)
    const auth = { Authorization: `Bearer ${token}` }
    const info = await fetch(`https://graph.facebook.com/v23.0/${adParam}?fields=id,name,status,effective_status,configured_status,issues_info,account_id,adset{status,effective_status},campaign{status,effective_status,special_ad_categories}`, { headers: auth })
    const check = await fetch(`https://graph.facebook.com/v23.0/${adParam}`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status: 'PAUSED', execution_options: '["validate_only"]' }),
    })
    // Lead ads: can this token see the Page and the instant form the ad uses?
    const cr = await (await fetch(`https://graph.facebook.com/v23.0/${adParam}?fields=creative{object_story_spec,effective_object_story_id,object_type,asset_feed_spec}`, { headers: auth })).json().catch(() => null)
    const spec = cr?.creative?.object_story_spec ?? {}
    const pageId = spec.page_id ?? String(cr?.creative?.effective_object_story_id ?? '').split('_')[0] ?? null
    const formId = spec.link_data?.call_to_action?.value?.lead_gen_form_id ?? spec.video_data?.call_to_action?.value?.lead_gen_form_id
      ?? cr?.creative?.asset_feed_spec?.call_to_actions?.[0]?.value?.lead_gen_form_id ?? null
    const page = pageId ? await (await fetch(`https://graph.facebook.com/v23.0/${pageId}?fields=id,name,tasks`, { headers: auth })).json().catch(() => null) : null
    const form = formId ? await (await fetch(`https://graph.facebook.com/v23.0/${formId}?fields=id,name,status`, { headers: auth })).json().catch(() => null) : null
    return json({ ad: await info.json().catch(() => null), validatePause: { http: check.status, body: await check.json().catch(() => null) }, pageId, page, formId, form, creativeError: cr?.error ?? null })
  }
  const res = await fetch('https://graph.facebook.com/v23.0/me/permissions', { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  const granted = (body.data ?? []).filter((p: { status: string }) => p.status === 'granted').map((p: { permission: string }) => p.permission)
  // What the system user may do on each ad account (ANALYZE = view, ADVERTISE = edit ads, MANAGE = full).
  const acc = await fetch('https://graph.facebook.com/v23.0/me/adaccounts?fields=account_id,name,user_tasks&limit=500', { headers: { Authorization: `Bearer ${token}` } })
  const accBody = await acc.json().catch(() => ({}))
  const accounts = (accBody.data ?? []).map((a: { account_id: string; name: string; user_tasks?: string[] }) => ({ id: a.account_id, name: a.name, tasks: a.user_tasks ?? [] }))
  const canEdit = accounts.filter((a: { tasks: string[] }) => a.tasks.includes('ADVERTISE') || a.tasks.includes('MANAGE')).length
  return json({ ok: res.ok, granted, error: body.error?.message ?? null, accounts: accounts.length, canEditAds: canEdit, viewOnly: accounts.filter((a: { tasks: string[] }) => !(a.tasks.includes('ADVERTISE') || a.tasks.includes('MANAGE'))).map((a: { name: string }) => a.name) })
})
