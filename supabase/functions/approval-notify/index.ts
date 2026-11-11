/**
 * approval-notify: posts in Slack (#mrkd-internal-app) when an ad made in The
 * Lab is submitted, sent back or approved. docs/ad-approval.md#slack-messages
 *
 * Called by the database (trigger on ad_review_events, via
 * private.call_function) with the cron secret: POST ?event=<ad_review_events.id>.
 * Posts through a Slack incoming webhook kept in the SLACK_APPROVALS_WEBHOOK_URL
 * secret. Without it, it does nothing (and says so).
 */
import { approvalMessage, type SlackPerson } from '../../../shared/domain/approvalSlack.ts'
import type { ReviewStatus } from '../../../shared/domain/approvals.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://sitebuilder-6iw.pages.dev'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const eventId = Number(new URL(req.url).searchParams.get('event'))
  if (!eventId) return json({ error: 'event missing' }, 400)
  const webhook = Deno.env.get('SLACK_APPROVALS_WEBHOOK_URL')
  if (!webhook) return json({ status: 'skipped', message: 'SLACK_APPROVALS_WEBHOOK_URL is not set.' })

  const db = serviceClient()
  const { data: ev, error } = await db.from('ad_review_events')
    .select('id, review_id, actor_id, from_status, to_status, note').eq('id', eventId).maybeSingle()
  if (error || !ev) return json({ error: error?.message ?? 'event not found' }, 404)
  const { data: r } = await db.from('ad_reviews')
    .select('id, name, client_id, created_by, reviewer_id, submitted_with_open_findings, legacy_id, client:clients(business_name)')
    .eq('id', ev.review_id).maybeSingle()
  if (!r || r.legacy_id) return json({ status: 'skipped', message: 'Not an ad made in The Lab.' })

  const ids = [ev.actor_id, r.reviewer_id, r.created_by].filter(Boolean) as string[]
  const { data: people } = await db.from('employees').select('id, first_name, last_name, slack_id').in('id', ids)
  const person = (id: string | null): SlackPerson | null => {
    const p = (people ?? []).find((x) => x.id === id)
    return p ? { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(), slackId: p.slack_id ?? null } : null
  }
  const client = (Array.isArray(r.client) ? r.client[0] : r.client) as { business_name: string | null } | null

  const text = approvalMessage({
    from: ev.from_status as ReviewStatus | null, to: ev.to_status as ReviewStatus,
    adName: r.name, clientName: client?.business_name ?? null, clientId: r.client_id,
    url: `${APP_URL}/approvals/${r.id}`, note: ev.note, openIssues: r.submitted_with_open_findings ?? 0,
    actor: person(ev.actor_id), reviewer: person(r.reviewer_id), creator: person(r.created_by),
  })
  if (!text) return json({ status: 'skipped', message: 'No message for this move.' })

  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  const body = await res.text()
  if (!res.ok) return json({ status: 'error', message: `Slack said ${res.status}: ${body.slice(0, 200)}` }, 502)
  return json({ status: 'ok' })
})
