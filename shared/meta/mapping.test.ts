import { describe, expect, it } from 'vitest'
import {
  accountStatusLabel,
  bareAccountId,
  budgetFromMinor,
  gendersLabel,
  isAdvantagePlus,
  mapInsightRow,
} from './mapping.ts'

describe('mapInsightRow', () => {
  it('maps Meta actions to our columns (same action types as Retool)', () => {
    const row = mapInsightRow({
      ad_id: '1',
      adset_id: '2',
      campaign_id: '3',
      account_id: '4',
      date_start: '2026-11-01',
      spend: '24.43',
      impressions: '1900',
      reach: '1500',
      clicks: '40',
      actions: [
        { action_type: 'link_click', value: '18' },
        { action_type: 'lead', value: '1' },
        { action_type: 'comment', value: '2' },
        { action_type: 'like', value: '3' },
        { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '4' },
        { action_type: 'video_view', value: '900' },
      ],
    })
    expect(row).toMatchObject({
      spend: 24.43,
      impressions: 1900,
      reach: 1500,
      clicks: 40,
      link_clicks: 18,
      leads: 1,
      comments: 2,
      page_likes: 3,
      messages: 4,
      date: '2026-11-01',
    })
    expect(row.actions.video_view).toBe(900)
  })
  it('treats missing values as zero', () => {
    const row = mapInsightRow({ ad_id: '1', adset_id: '2', campaign_id: '3', account_id: '4', date_start: '2026-11-01' })
    expect(row.spend).toBe(0)
    expect(row.leads).toBe(0)
  })
})

describe('helpers', () => {
  it('account status labels', () => {
    expect(accountStatusLabel(1)).toBe('ACTIVE')
    expect(accountStatusLabel('3')).toBe('UNSETTLED')
    expect(accountStatusLabel(999)).toBe('UNKNOWN')
  })
  it('budgets come in cents', () => {
    expect(budgetFromMinor('3000')).toBe(30)
    expect(budgetFromMinor(null)).toBeNull()
  })
  it('strips act_ prefix', () => {
    expect(bareAccountId('act_123')).toBe('123')
    expect(bareAccountId('123')).toBe('123')
  })
  it('advantage+ and genders', () => {
    expect(isAdvantagePlus({ targeting_automation: { advantage_audience: 1 } })).toBe(true)
    expect(isAdvantagePlus({})).toBe(false)
    expect(gendersLabel(undefined)).toBe('All')
    expect(gendersLabel([2])).toBe('Female')
  })
})
