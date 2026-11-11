/**
 * SAMPLE DATA implementation of DataSource. Builds report rows from the
 * generated dataset using the same rules as the SQL `report()` function
 * (supabase/migrations/0600), so the screens behave identically once real
 * data is connected:
 *   - only Active/New clients
 *   - an entity is ACTIVE only if it and all parents are active
 *   - campaigns/ad sets/ads are listed if they spent or are currently active
 */
import { sumTotals, EMPTY_TOTALS } from '@shared/domain/metrics.ts'
import { DEFAULT_RULE_SETTINGS, type RuleSettings } from '@shared/domain/rules.ts'
import { addDays, todayInZone } from '@shared/domain/dates.ts'
import type { DateRange, DeliveryStatus, Level, ReportRow, Totals } from '@shared/domain/types.ts'
import { generateMockData, type MockAccount, type MockClient, type MockDataset, type MockDay } from './mock/generate'
import type { DataSource, SyncRun } from './source'
import { createMockApprovals } from './approvalsMock'

/** localStorage key for the sample-mode "Viewing as" switch. */
export const VIEW_AS_KEY = 'mrkd.viewAs'

const ACTIVE_ACCOUNT = new Set(['ACTIVE', 'IN_GRACE_PERIOD', 'UNSETTLED'])

function deliveryStatus(accountStatus: string, ...statuses: string[]): DeliveryStatus {
  if (!ACTIVE_ACCOUNT.has(accountStatus)) return 'DISABLED'
  if (statuses.some((s) => s === 'DELETED' || s === 'ARCHIVED')) return 'REMOVED'
  if (statuses.some((s) => s === 'PAUSED')) return 'PAUSED'
  if (statuses.every((s) => s === 'ACTIVE')) return 'ACTIVE'
  return 'OTHER'
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createMockSource(data: MockDataset = generateMockData()): DataSource {
  const managerName = new Map(data.employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]))
  const clientById = new Map(data.clients.map((c) => [c.id, c]))
  const accountById = new Map(data.accounts.map((a) => [a.accountId, a]))
  const campaignById = new Map(data.campaigns.map((c) => [c.id, c]))
  const adsetById = new Map(data.adsets.map((s) => [s.id, s]))
  const creativeById = new Map(data.creatives.map((c) => [c.id, c]))

  /** Everything we know about an ad's parents, flattened. */
  const adContext = new Map(
    data.ads.map((ad) => {
      const adset = adsetById.get(ad.adsetId)!
      const campaign = campaignById.get(adset.campaignId)!
      const account = accountById.get(campaign.accountId)!
      const client = clientById.get(account.clientId)!
      return [ad.id, { ad, adset, campaign, account, client }]
    }),
  )

  const isLive = (status: string) => status === 'Active' || status === 'New'

  function totalsByAd(range: DateRange): Map<string, Totals> {
    const out = new Map<string, MockDay[]>()
    for (const d of data.days) {
      if (d.date < range.from || d.date > range.to) continue
      const list = out.get(d.adId)
      if (list) list.push(d)
      else out.set(d.adId, [d])
    }
    return new Map([...out].map(([id, days]) => [id, sumTotals(days)]))
  }

  function base(account: MockAccount, client: MockClient) {
    return {
      accountId: account.accountId,
      accountName: account.name,
      accountActive: ACTIVE_ACCOUNT.has(account.statusLabel),
      currency: account.currency,
      clientId: client.id,
      clientName: client.name,
      clientStatus: client.status,
      managerId: client.managerId,
      managerName: managerName.get(client.managerId) ?? null,
    }
  }

  async function report(level: Level, range: DateRange): Promise<ReportRow[]> {
    await wait(120) // feel like a network call
    const totals = totalsByAd(range)
    const groups = new Map<string, { row: Omit<ReportRow, keyof Totals>; parts: Totals[] }>()

    if (level === 'account') {
      for (const account of data.accounts) {
        const client = clientById.get(account.clientId)!
        if (!isLive(client.status)) continue
        groups.set(account.accountId, {
          row: {
            level,
            id: account.accountId,
            name: account.name,
            status: deliveryStatus(account.statusLabel, 'ACTIVE'),
            statusLabel: account.statusLabel,
            ...base(account, client),
            leadsSheetUrl: client.leadsSheetUrl,
          },
          parts: [],
        })
      }
    }

    for (const ctx of adContext.values()) {
      if (!isLive(ctx.client.status)) continue
      const t = totals.get(ctx.ad.id) ?? EMPTY_TOTALS
      const { ad, adset, campaign, account } = ctx
      let key: string
      let row: Omit<ReportRow, keyof Totals>
      switch (level) {
        case 'account':
          key = account.accountId
          break
        case 'campaign':
          key = campaign.id
          row = {
            level, id: campaign.id, name: campaign.name,
            status: deliveryStatus(account.statusLabel, campaign.status), statusLabel: campaign.status,
            ...base(account, ctx.client), campaignId: campaign.id, campaignName: campaign.name,
            dailyBudget: campaign.dailyBudget, objective: campaign.objective, bidStrategy: campaign.bidStrategy,
            buyingType: 'AUCTION', pacingType: 'standard',
          }
          break
        case 'adset':
          key = adset.id
          row = {
            level, id: adset.id, name: adset.name,
            status: deliveryStatus(account.statusLabel, campaign.status, adset.status), statusLabel: adset.status,
            ...base(account, ctx.client), campaignId: campaign.id, campaignName: campaign.name, adsetId: adset.id, adsetName: adset.name,
            optimizationGoal: adset.optimizationGoal, advantagePlus: adset.advantagePlus, learningStage: adset.learningStage,
            ageMin: adset.ageMin, ageMax: adset.ageMax, genders: adset.genders,
          }
          break
        case 'ad': {
          key = ad.id
          const creative = creativeById.get(ad.creativeId)
          row = {
            level, id: ad.id, name: ad.name,
            status: deliveryStatus(account.statusLabel, campaign.status, adset.status, ad.status), statusLabel: ad.status,
            ...base(account, ctx.client), campaignId: campaign.id, campaignName: campaign.name, adsetId: adset.id, adsetName: adset.name,
            creativeId: ad.creativeId, thumbnailUrl: creative?.imageUrl ?? null,
          }
          break
        }
      }
      const g = groups.get(key)
      if (g) g.parts.push(t)
      else groups.set(key, { row: row!, parts: [t] })
    }

    const rows: ReportRow[] = [...groups.values()].map(({ row, parts }) => ({ ...row, ...sumTotals(parts) }) as ReportRow)
    // Value generated is an account-level figure (from the lead sheets).
    if (level !== 'account') for (const r of rows) r.valueGenerated = 0
    return rows
      .filter((r) => level === 'account' || r.spend > 0 || r.impressions > 0 || r.status === 'ACTIVE')
      .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name))
  }

  // Sample mode: client changes kept in memory only (screens only; numbers unchanged).
  const sampleOverrides = new Map<number, { status?: string; managerId?: string; note?: string }>()
  // Sample mode keeps threshold changes in memory only (gone on reload).
  let sampleSettings: Partial<RuleSettings> = { ...DEFAULT_RULE_SETTINGS }
  let sampleSettingsAt: string | null = null

  const approvals = createMockApprovals({
    employees: data.employees,
    clients: data.clients,
    meId: async () => {
      try {
        return localStorage.getItem(VIEW_AS_KEY) ?? 'emp_alex'
      } catch {
        return 'emp_alex'
      }
    },
  })

  return {
    kind: 'sample',
    approvals,
    async me() {
      // Sample mode has no login: "Viewing as" in the banner picks who you are.
      let id = 'emp_alex'
      try {
        id = localStorage.getItem(VIEW_AS_KEY) ?? id
      } catch {
        /* ignore */
      }
      return data.employees.find((e) => e.id === id) ?? data.employees[0]
    },
    async employees() {
      return data.employees
    },
    report,
    async leads(range) {
      await wait(80)
      return data.leads
        .filter((l) => l.createdAt.slice(0, 10) >= range.from && l.createdAt.slice(0, 10) <= range.to)
        .map((l) => {
          const ctx = adContext.get(l.adId)!
          const form = data.leadForms.find((f) => f.id === l.formId)
          return {
            id: l.id, createdAt: l.createdAt, name: l.name, email: l.email, phone: l.phone,
            formId: l.formId, formName: form?.name ?? null, adId: l.adId, adName: ctx.ad.name,
            accountId: ctx.account.accountId, clientId: ctx.client.id, managerId: ctx.client.managerId,
          }
        })
        .filter((l) => isLive(clientById.get(l.clientId!)!.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async creative(id) {
      return creativeById.get(id) ?? null
    },
    async recentLeadsByAccount(days) {
      const today = todayInZone()
      const from = addDays(today, -days)
      const out = new Map<string, number>()
      for (const d of data.days) {
        if (d.date < from || d.date >= today) continue
        const acc = adContext.get(d.adId)!.account.accountId
        out.set(acc, (out.get(acc) ?? 0) + d.leads)
      }
      return out
    },
    async ruleSettings() {
      return sampleSettings
    },
    async ruleSettingsInfo() {
      return { params: sampleSettings, updatedAt: sampleSettingsAt, updatedBy: sampleSettingsAt ? 'You (sample data)' : null }
    },
    async saveRuleSettings(params) {
      await wait(200)
      sampleSettings = { ...sampleSettings, ...params }
      sampleSettingsAt = new Date().toISOString()
    },
    async staff() {
      return data.employees.map((e) => ({
        id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, isAdManager: e.isAdManager,
        active: e.active, role: e.role ?? 'staff', signedIn: e.id === 'emp_alex' || e.id === 'emp_olive',
        clients: data.clients.filter((c) => c.managerId === e.id && isLive(c.status)).length,
      }))
    },
    async setRole(employeeId, role) {
      // Sample mode: same rules as set_employee_role, kept in memory.
      const me = data.employees.find((e) => e.id === (localStorage.getItem(VIEW_AS_KEY) ?? 'emp_alex'))
      const target = data.employees.find((e) => e.id === employeeId)
      if (!me || !target) throw new Error('Staff member not found.')
      if (me.role !== 'owner' && me.role !== 'admin') throw new Error('Only owners and admins can change roles.')
      if ((role === 'owner' || target.role === 'owner') && me.role !== 'owner') throw new Error("Only an owner can make someone an owner or change an owner's role.")
      if (target.role === 'owner' && data.employees.filter((e) => e.role === 'owner').length <= 1) throw new Error('This is the last owner. Make someone else an owner first.')
      target.role = role
    },
    async resetTwoStep() {
      /* sample mode: nothing to reset */
    },
    async setStaffActive(employeeId, active) {
      const e = data.employees.find((x) => x.id === employeeId)
      if (e) e.active = active
    },
    async clients() {
      return data.clients.map((c) => {
        const o = sampleOverrides.get(c.id)
        const managerId = o?.managerId ?? c.managerId
        const m = data.employees.find((e) => e.id === managerId)
        return {
          id: c.id, name: c.name, status: o?.status ?? c.status, managerId, managerName: m ? `${m.firstName} ${m.lastName}` : null,
          city: c.city, state: null, overridden: !!o, statusOverride: o?.status ?? null, managerOverride: o?.managerId ?? null,
          note: o?.note ?? null, overrideBy: o ? 'You (sample data)' : null, overrideAt: o ? new Date().toISOString() : null,
          accounts: data.accounts.filter((a) => a.clientId === c.id).map((a) => ({ id: a.accountId, name: a.name, status: a.statusLabel, linkedInLab: false })),
        }
      }).sort((a, b) => a.name.localeCompare(b.name))
    },
    async unlinkedAccounts() {
      return []
    },
    async setClient(clientId, c) {
      if (c.clear) {
        sampleOverrides.delete(clientId)
        return
      }
      const o = sampleOverrides.get(clientId) ?? {}
      sampleOverrides.set(clientId, { ...o, ...(c.status ? { status: c.status } : {}), ...(c.managerId ? { managerId: c.managerId } : {}), ...(c.note ? { note: c.note } : {}) })
    },
    async searchLeadForms(query) {
      const q = query.trim().toLowerCase()
      return data.leadForms
        .filter((f) => !q || JSON.stringify(f).toLowerCase().includes(q))
        .map((f) => ({ id: f.id, name: f.name, pageId: f.pageId, questions: f.questions, contextCardTitle: f.contextCardTitle, thankYouTitle: f.thankYouTitle }))
    },
    async searchAdCopy(query) {
      const q = query.trim().toLowerCase()
      return data.creatives.filter((c) => !q || [c.name, c.title, c.body].join(' ').toLowerCase().includes(q)).slice(0, 100)
    },
    async syncRuns(): Promise<SyncRun[]> {
      const now = Date.now()
      const ago = (min: number) => new Date(now - min * 60_000).toISOString()
      return [
        { job: 'meta.sync', startedAt: ago(12), finishedAt: ago(11), status: 'ok', rows: 1240, error: null },
        { job: 'rules.run', startedAt: ago(11), finishedAt: ago(11), status: 'ok', rows: 9, error: null },
        { job: 'retool_bridge', startedAt: ago(4), finishedAt: ago(4), status: 'ok', rows: 6612, error: null },
        { job: 'meta.sync', startedAt: ago(42), finishedAt: ago(41), status: 'partial', rows: 1198, error: '1 account failed: token missing permission' },
      ]
    },
    async storedSuggestions() {
      return null // sample mode: the page runs the rules in the browser
    },
    async updateSuggestion() {
      /* sample mode: nothing is saved */
    },
    async turnOffAd() {
      await wait(400)
      return { ok: true, verified: true, at: new Date().toISOString(), message: 'Sample data: nothing was changed in Meta.' }
    },
    async undoTurnOff() {
      await wait(300)
      return { ok: true, verified: true, at: new Date().toISOString(), message: 'Sample data: nothing was changed in Meta.' }
    },
    async recentActions() {
      return []
    },
    async lastUpdated() {
      return new Date(Date.now() - 11 * 60_000).toISOString()
    },
  }
}
