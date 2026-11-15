import { describe, expect, it } from 'vitest'
import { derive, EMPTY_TOTALS, kpiSummary, percentChange, ratio, sumTotals } from './metrics.ts'
import type { ReportRow, Totals } from './types.ts'

const totals = (t: Partial<Totals>): Totals => ({ ...EMPTY_TOTALS, ...t })

function accountRow(id: string, t: Partial<Totals>, accountActive = true): ReportRow {
  return {
    ...totals(t),
    level: 'account',
    id,
    name: id,
    status: 'ACTIVE',
    statusLabel: 'ACTIVE',
    accountId: id,
    accountName: id,
    accountActive,
    currency: 'USD',
    clientId: 1,
    clientName: 'Client',
    clientStatus: 'Active',
    managerId: 'm1',
    managerName: 'Manager',
  }
}

describe('ratio', () => {
  it('returns null instead of dividing by zero', () => {
    expect(ratio(10, 0)).toBeNull()
    expect(ratio(0, 0)).toBeNull()
    expect(ratio(10, 4)).toBe(2.5)
  })
})

describe('derive (formulas match Retool Meta Ads Insights)', () => {
  const m = derive(
    totals({ spend: 244.3, leads: 10, impressions: 19_000, reach: 12_000, linkClicks: 128, clicks: 300 }),
  )
  it('CPL = spend / leads', () => expect(m.cpl).toBeCloseTo(24.43))
  it('CPM = spend / impressions × 1000', () => expect(m.cpm).toBeCloseTo(12.857, 2))
  it('CPR = spend / reach × 1000', () => expect(m.cpr).toBeCloseTo(20.358, 2))
  it('CPLC = spend / link clicks', () => expect(m.cplc).toBeCloseTo(1.9086, 3))
  it('CR % = leads / link clicks × 100', () => expect(m.cr).toBeCloseTo(7.8125))
  it('CTR % = clicks / impressions × 100', () => expect(m.ctr).toBeCloseTo(1.5789, 3))
  it('Link CTR % = link clicks / impressions × 100', () => expect(m.linkCtr).toBeCloseTo(0.6737, 3))
  it('is null when there is nothing to divide by', () => {
    const empty = derive(EMPTY_TOTALS)
    expect(Object.values(empty).every((v) => v === null)).toBe(true)
  })
})

describe('sumTotals', () => {
  it('adds every field', () => {
    const s = sumTotals([totals({ spend: 1, leads: 2 }), totals({ spend: 3, leads: 4, booked: 1 })])
    expect(s.spend).toBe(4)
    expect(s.leads).toBe(6)
    expect(s.booked).toBe(1)
  })
})

describe('kpiSummary', () => {
  const rows = [
    accountRow('a', { spend: 100, leads: 4 }),
    accountRow('b', { spend: 50, leads: 1 }, false),
    accountRow('c', { spend: 30, leads: 0 }),
  ]
  it('counts active accounts from all rows', () => {
    expect(kpiSummary(rows).activeAccounts).toBe(2)
  })
  it('uses all rows when nothing is selected', () => {
    const k = kpiSummary(rows)
    expect(k.spend).toBe(180)
    expect(k.leads).toBe(5)
    expect(k.cpl).toBe(36)
  })
  it('uses only selected rows for totals (Retool behaviour), but still counts all active accounts', () => {
    const k = kpiSummary(rows, new Set(['a']))
    expect(k.spend).toBe(100)
    expect(k.cpl).toBe(25)
    expect(k.activeAccounts).toBe(2)
  })
})

describe('percentChange', () => {
  it('computes change vs previous', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20)
    expect(percentChange(80, 100)).toBeCloseTo(-20)
  })
  it('is null without a usable previous value', () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(null, 5)).toBeNull()
  })
})

describe('active ads CPL', () => {
  const ad = (o: Partial<import('./types.ts').ReportRow>) => ({ level: 'ad', id: 'x', name: 'x', status: 'ACTIVE', statusLabel: 'ACTIVE', accountId: 'A', campaignId: 'C1', adsetId: 'S1', spend: 0, leads: 0, ...o }) as import('./types.ts').ReportRow
  it('counts only running ads, per account, campaign and ad set', async () => {
    const { activeTotals, withActiveTotals, activeCpl } = await import('./metrics.ts')
    const t = activeTotals([
      ad({ spend: 100, leads: 4 }),
      ad({ spend: 50, leads: 1, campaignId: 'C2', adsetId: 'S2' }),
      ad({ spend: 300, leads: 2, status: 'PAUSED' }), // turned off: only in the overall CPL
    ])
    expect(t.get('all')).toEqual({ spend: 150, leads: 5 })
    expect(t.get('campaign:C1')).toEqual({ spend: 100, leads: 4 })
    const [acc] = withActiveTotals([{ ...ad({ spend: 450, leads: 7 }), level: 'account', id: 'A' }], t)
    expect(activeCpl(acc)).toBe(30) // vs overall 450 / 7 = 64.29
    const [none] = withActiveTotals([{ ...ad({ spend: 10, leads: 1 }), level: 'campaign', id: 'C9' }], t)
    expect(activeCpl(none)).toBeNull()
  })
})
