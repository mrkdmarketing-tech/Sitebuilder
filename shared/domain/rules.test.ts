import { describe, expect, it } from 'vitest'
import { EMPTY_TOTALS } from './metrics.ts'
import { evaluateRules, groupByAccount } from './rules.ts'
import type { ReportRow, Totals } from './types.ts'

function ad(id: string, adsetId: string, t: Partial<Totals>, extra: Partial<ReportRow> = {}): ReportRow {
  return {
    ...EMPTY_TOTALS,
    ...t,
    level: 'ad',
    id,
    name: `Ad ${id}`,
    status: 'ACTIVE',
    statusLabel: 'ACTIVE',
    accountId: 'acc1',
    accountName: 'Renzo Gracie Boca',
    accountActive: true,
    currency: 'USD',
    adsetId,
    clientId: 7,
    clientName: 'Renzo Gracie Boca',
    clientStatus: 'Active',
    managerId: 'm1',
    managerName: 'Manager',
    ...extra,
  }
}

function account(extra: Partial<ReportRow> = {}): ReportRow {
  return { ...ad('acc1', '', {}), level: 'account', name: 'Renzo Gracie Boca', ...extra }
}

const healthy = { impressions: 5000, clicks: 100, linkClicks: 60 } // CTR 2%, link CTR 1.2%
const run = (ads: ReportRow[], accounts: ReportRow[] = [], recent = new Map([['acc1', 5]])) =>
  evaluateRules({ ads, accounts, recentLeadsByAccount: recent })

describe('rule 1: expensive leads (CPL > $50)', () => {
  it('flags 1 lead at $120 with a turn-off action', () => {
    const [s] = run([ad('1', 'set1', { ...healthy, spend: 120, leads: 1 })])
    expect(s.rule).toBe('expensive_cpl')
    expect(s.message).toBe('Ad 1 has 1 lead at $120 each.')
    expect(s.action).toEqual({ type: 'pause_ad', adId: '1' })
  })
  it('does not flag CPL of exactly $50', () => {
    expect(run([ad('1', 'set1', { ...healthy, spend: 100, leads: 2 })])).toEqual([])
  })
})

describe('rule 2: spend with no leads', () => {
  it('flags > $50 spent with 0 leads', () => {
    const [s] = run([ad('1', 'set1', { ...healthy, spend: 64, leads: 0 })])
    expect(s.rule).toBe('no_leads_spend')
    expect(s.message).toBe('Ad 1 spent $64 with no leads.')
  })
  it('ignores small spend', () => {
    expect(run([ad('1', 'set1', { ...healthy, spend: 30, leads: 0 })])).toEqual([])
  })
})

describe('rule 3: budget hog', () => {
  it('flags the ad taking most of the ad set budget at a bad CPL, and lists siblings', () => {
    const ads = [
      ad('hog', 'set1', { ...healthy, spend: 180, leads: 2 }), // 75% share, $90 CPL
      ad('b', 'set1', { ...healthy, spend: 40, leads: 3 }),
      ad('c', 'set1', { ...healthy, spend: 20, leads: 1 }),
    ]
    const res = run(ads)
    expect(res).toHaveLength(1)
    const [s] = res
    expect(s.rule).toBe('budget_hog')
    expect(s.entityId).toBe('hog')
    expect(s.message).toBe("Ad hog took 75% of its ad set's spend ($180) for 2 leads at $90 each.")
    expect(s.siblings?.map((x) => x.id)).toEqual(['b', 'c'])
  })
  it('does not flag a dominant ad that is performing well', () => {
    const ads = [
      ad('a', 'set1', { ...healthy, spend: 300, leads: 15 }), // $20 CPL
      ad('b', 'set1', { ...healthy, spend: 50, leads: 2 }),
    ]
    expect(run(ads)).toEqual([])
  })
  it('needs at least one other ad in the ad set', () => {
    const [s] = run([ad('solo', 'set1', { ...healthy, spend: 200, leads: 2 })])
    expect(s.rule).toBe('expensive_cpl')
  })
})

describe('rules 4–5: low CTR / link CTR', () => {
  it('flags low link CTR after enough impressions', () => {
    const [s] = run([ad('1', 'set1', { impressions: 4000, clicks: 60, linkClicks: 12, spend: 40, leads: 2 })])
    expect(s.rule).toBe('low_link_ctr') // 0.3% link CTR; CTR 1.5% is fine
    expect(s.severity).toBe('medium')
  })
  it('flags low CTR', () => {
    const [s] = run([ad('1', 'set1', { impressions: 4000, clicks: 20, linkClicks: 25, spend: 40, leads: 2 })])
    expect(s.rule).toBe('low_ctr')
  })
  it('waits for 1,000 impressions before judging', () => {
    expect(run([ad('1', 'set1', { impressions: 900, clicks: 1, linkClicks: 1, spend: 10, leads: 1 })])).toEqual([])
  })
})

describe('one suggestion per ad, most important first', () => {
  it('prefers turning off an expensive ad over a CTR note', () => {
    const res = run([ad('1', 'set1', { impressions: 5000, clicks: 10, linkClicks: 5, spend: 120, leads: 1 })])
    expect(res.map((s) => s.rule)).toEqual(['expensive_cpl'])
  })
})

describe('scope', () => {
  it('ignores paused ads and inactive clients', () => {
    const res = run([
      ad('1', 'set1', { ...healthy, spend: 120, leads: 1 }, { status: 'PAUSED' }),
      ad('2', 'set2', { ...healthy, spend: 120, leads: 1 }, { clientStatus: 'Inactive' }),
    ])
    expect(res).toEqual([])
  })
})

describe('account rules', () => {
  it('flags an unsettled account', () => {
    const [s] = run([], [account({ statusLabel: 'UNSETTLED' })])
    expect(s.rule).toBe('account_issue')
    expect(s.message).toBe('Ad account is unsettled, so ads may not be running.')
  })
  it('flags no leads in 3 days', () => {
    const [s] = run([], [account()], new Map([['acc1', 0]]))
    expect(s.rule).toBe('no_recent_leads')
  })
})

describe('groupByAccount', () => {
  it('makes one overview per account, most urgent first', () => {
    const res = run([
      ad('1', 'set1', { ...healthy, spend: 120, leads: 1 }),
      ad('2', 'set2', { impressions: 4000, clicks: 20, linkClicks: 25, spend: 40, leads: 2 }),
      ad('3', 'set3', { ...healthy, spend: 120, leads: 1 }, { accountId: 'acc2', accountName: 'Other Gym' }),
    ])
    const groups = groupByAccount(res)
    expect(groups.map((g) => g.accountId)).toEqual(['acc1', 'acc2'])
    expect(groups[0].suggestions.map((s) => s.rule)).toEqual(['expensive_cpl', 'low_ctr'])
  })
})
