import { describe, expect, it } from 'vitest'
import { approvalMessage, type ApprovalEvent } from './approvalSlack.ts'

const jordan = { name: 'Jordan Bosley', slackId: 'U04JWRD80QJ' }
const adam = { name: 'Adam Schmidt', slackId: 'U04JZ9L67CL' }
const base: ApprovalEvent = {
  from: 'draft', to: 'review_pending', adName: 'renton> kids nov 11', clientName: 'Gracie Barra Renton', clientId: 168,
  url: 'https://sitebuilder-6iw.pages.dev/approvals/abc', note: null, openIssues: 0, actor: adam, reviewer: jordan, creator: adam,
}

describe('approval Slack message', () => {
  it('tags the reviewer for a new ad, like Retool', () => {
    expect(approvalMessage(base)).toBe([
      '*Ad for Review (NEW)*', '', '*Name*: renton&gt; kids nov 11', '*Client:* Gracie Barra Renton (168)',
      '*URL:* <https://sitebuilder-6iw.pages.dev/approvals/abc|Open in The Lab>', '', '<@U04JWRD80QJ|Jordan Bosley>',
    ].join('\n'))
  })
  it('says when it was sent again and how many issues were left open', () => {
    const m = approvalMessage({ ...base, from: 'request_changes', openIssues: 2 })!
    expect(m).toContain('(AGAIN)')
    expect(m).toContain('*Possible issues left open:* 2')
  })
  it('tags the person who made the ad when changes are requested or it is approved', () => {
    const m = approvalMessage({ ...base, from: 'review_pending', to: 'request_changes', note: 'Fix the address', actor: jordan })!
    expect(m).toContain('*What needs to change:* Fix the address')
    expect(m).toContain('*By:* Jordan Bosley')
    expect(m.endsWith('<@U04JZ9L67CL|Adam Schmidt>')).toBe(true)
    expect(approvalMessage({ ...base, from: 'review_pending', to: 'approved', actor: jordan })).toContain('Review Completed')
  })
  it('stays quiet for Mark as live', () => {
    expect(approvalMessage({ ...base, from: 'approved', to: 'completed' })).toBeNull()
  })
})
