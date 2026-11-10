/**
 * meta-check — reports what the Meta system user token is allowed to do
 * (its granted scopes), without ever returning the token. Admin diagnostic,
 * called with the cron secret. docs/background-jobs.md
 */
import { isAuthorisedCron, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const token = Deno.env.get('META_SYSTEM_USER_TOKEN')
  if (!token) return json({ error: 'META_SYSTEM_USER_TOKEN not set' }, 500)
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
