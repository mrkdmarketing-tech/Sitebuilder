import { describe, expect, it } from 'vitest'
import { greeting, primaryButton, todayLine, todayOrder } from './today.ts'

describe('todayLine', () => {
  it('writes one plain sentence per rule', () => {
    expect(todayLine({ rule: 'no_leads_spend', evidence: { spend: 240, leads: 0 } })).toBe('An ad spent $240 with no leads')
    expect(todayLine({ rule: 'expensive_cpl', evidence: { spend: 143, leads: 2, cpl: 71.52 } })).toBe('An ad is costing $71.52 a lead')
    expect(todayLine({ rule: 'budget_hog', evidence: { spend: 86, leads: 1, cpl: 85.89, share: 0.78 } })).toBe("One ad is taking 78% of its ad set's budget at $85.89 a lead")
    expect(todayLine({ rule: 'budget_hog', evidence: { spend: 90, leads: 0, cpl: null, share: 0.65 } })).toBe("One ad is taking 65% of its ad set's budget with no leads")
    expect(todayLine({ rule: 'low_link_ctr', evidence: { linkCtr: 0.37 } })).toBe("Few people click an ad's link (0.37%)")
    expect(todayLine({ rule: 'account_issue', evidence: { status: 'UNSETTLED' } })).toBe('Ad account is unsettled, ads may not be running')
    expect(todayLine({ rule: 'no_recent_leads', evidence: { days: 3, leads: 0 } })).toBe('No leads in the last 3 days')
  })
  it('copes with missing numbers', () => {
    expect(todayLine({ rule: 'expensive_cpl', evidence: {} })).toBe('An ad has expensive leads')
    expect(todayLine({ rule: 'no_leads_spend', evidence: { spend: 1234.5 } })).toBe('An ad spent $1,235 with no leads')
  })
})

describe('primaryButton', () => {
  it('picks one button', () => {
    expect(primaryButton({ rule: 'expensive_cpl', level: 'ad', action: { type: 'pause_ad', adId: 'a' } })).toBe('turn_off')
    expect(primaryButton({ rule: 'low_ctr', level: 'ad', action: { type: 'review_creative', adId: 'a' } })).toBe('open_ad')
    expect(primaryButton({ rule: 'account_issue', level: 'account', action: { type: 'check_account', accountId: '1' } })).toBe('open_billing')
    expect(primaryButton({ rule: 'no_recent_leads', level: 'account', action: { type: 'check_account', accountId: '1' } })).toBe('open_account')
  })
})

describe('todayOrder', () => {
  it('puts urgent and expensive first', () => {
    const list = [
      { id: 1, severity: 'medium' as const, evidence: { spend: 500 } },
      { id: 2, severity: 'high' as const, evidence: { spend: 50 } },
      { id: 3, severity: 'high' as const, evidence: { spend: 240 } },
    ]
    expect(todayOrder(list).map((x) => x.id)).toEqual([3, 2, 1])
  })
})

describe('greeting', () => {
  it('uses Toronto time', () => {
    expect(greeting(new Date('2026-11-11T13:00:00Z'))).toBe('Good morning') // 8am Toronto
    expect(greeting(new Date('2026-11-11T19:00:00Z'))).toBe('Good afternoon') // 2pm
    expect(greeting(new Date('2026-11-11T23:30:00Z'))).toBe('Good evening') // 6:30pm
  })
})
