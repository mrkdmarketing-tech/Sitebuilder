import { describe, expect, it } from 'vitest'
import { eachDay, presetRange, previousRange, rangeLength, todayInZone } from './dates.ts'

// Monday 9 Nov 2026
const TODAY = '2026-11-09'

describe('presetRange', () => {
  it('today / yesterday', () => {
    expect(presetRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
    expect(presetRange('yesterday', TODAY)).toEqual({ from: '2026-11-08', to: '2026-11-08' })
  })
  it('last N days excludes today', () => {
    expect(presetRange('last_7_days', TODAY)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(rangeLength(presetRange('last_14_days', TODAY))).toBe(14)
    expect(rangeLength(presetRange('last_30_days', TODAY))).toBe(30)
  })
  it('weeks start on Monday', () => {
    expect(presetRange('this_week', TODAY)).toEqual({ from: '2026-11-09', to: TODAY })
    expect(presetRange('this_week', '2026-11-08')).toEqual({ from: '2026-11-02', to: '2026-11-08' }) // Sunday
    expect(presetRange('last_week', TODAY)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
  })
  it('months', () => {
    expect(presetRange('this_month', TODAY)).toEqual({ from: '2026-11-01', to: TODAY })
    expect(presetRange('last_month', TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(presetRange('last_month', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

describe('previousRange', () => {
  it('is the same length, ending the day before', () => {
    expect(previousRange({ from: '2026-11-01', to: '2026-11-06' })).toEqual({
      from: '2026-10-26',
      to: '2026-10-31',
    })
  })
})

describe('eachDay', () => {
  it('lists every day inclusive', () => {
    expect(eachDay({ from: '2026-10-30', to: '2026-11-02' })).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
  })
})

describe('todayInZone', () => {
  it('uses the Toronto calendar day, including daylight saving', () => {
    // 03:30 UTC on 9 Nov = 22:30 on 8 Nov in Toronto (EST, UTC−5).
    expect(todayInZone(new Date('2026-11-09T03:30:00Z'))).toBe('2026-11-08')
    // 03:30 UTC on 9 Jul = 23:30 on 8 Jul in Toronto (EDT, UTC−4).
    expect(todayInZone(new Date('2026-07-09T03:30:00Z'))).toBe('2026-07-08')
    expect(todayInZone(new Date('2026-07-09T04:30:00Z'))).toBe('2026-07-09')
  })
})
