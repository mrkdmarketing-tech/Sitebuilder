/**
 * The Slack message posted in #mrkd-internal-app when an ad moves
 * (docs/ad-approval.md#slack-messages). Same layout as Retool's Ad Preview
 * messages, so the channel reads the same; links open the ad in The Lab.
 */
import type { ReviewStatus } from './approvals.ts'

export interface SlackPerson {
  name: string
  slackId: string | null
}

export interface ApprovalEvent {
  from: ReviewStatus | null
  to: ReviewStatus
  adName: string
  clientName: string | null
  clientId: number | null
  url: string
  note: string | null
  /** Possible issues still open when it was submitted. */
  openIssues: number
  actor: SlackPerson | null
  reviewer: SlackPerson | null
  creator: SlackPerson | null
}

/** Slack's text format treats &, < and > as markup. */
export const slackEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const tag = (p: SlackPerson | null) => (!p ? null : p.slackId ? `<@${p.slackId}|${slackEscape(p.name)}>` : slackEscape(p.name))

/** The message text, or null when this move doesn't need one. */
export function approvalMessage(e: ApprovalEvent): string | null {
  let title: string
  let who: SlackPerson | null
  if (e.to === 'review_pending') {
    title = e.from === 'request_changes' ? '*Ad for Review (AGAIN)*' : '*Ad for Review (NEW)*'
    who = e.reviewer
  } else if (e.to === 'request_changes') {
    title = '*Ad - Changes Requested*'
    who = e.creator
  } else if (e.to === 'approved') {
    title = '*Ad - Review Completed (approved)*'
    who = e.creator
  } else {
    return null // "Mark as live" doesn't need a ping.
  }
  const lines = [
    title,
    '',
    `*Name*: ${slackEscape(e.adName)}`,
    `*Client:* ${slackEscape(e.clientName ?? 'No client')}${e.clientId != null ? ` (${e.clientId})` : ''}`,
    `*URL:* <${e.url}|Open in The Lab>`,
  ]
  if (e.to === 'review_pending' && e.openIssues > 0) {
    lines.push(`*Possible issues left open:* ${e.openIssues}`)
  }
  if (e.note) lines.push(`*${e.to === 'request_changes' ? 'What needs to change' : 'Comment'}:* ${slackEscape(e.note)}`)
  if (e.actor && e.to !== 'review_pending') lines.push(`*By:* ${slackEscape(e.actor.name)}`)
  const mention = tag(who)
  if (mention) lines.push('', mention)
  return lines.join('\n')
}
