/**
 * Fictional sample data for SAMPLE DATA mode. Every gym, person and number is
 * made up. Generated from a fixed seed so everyone sees the same numbers.
 *
 * Deliberately includes the situations the suggestion rules look for (a
 * budget-hog ad, expensive leads, spend with no leads, low CTR, an unsettled
 * account), so the Suggestions screen has something to show.
 */
import { addDays, todayInZone } from '@shared/domain/dates.ts'
import type { Creative, Employee } from '@shared/domain/types.ts'

// --- deterministic random numbers ------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MockClient {
  id: number
  name: string
  status: 'Active' | 'New' | 'Paused' | 'Inactive'
  managerId: string
  city: string
  leadsSheetUrl: string
}
export interface MockAccount {
  accountId: string
  name: string
  clientId: number
  statusLabel: string
  currency: string
}
export interface MockCampaign {
  id: string
  accountId: string
  name: string
  status: string
  dailyBudget: number
  objective: string
  bidStrategy: string
}
export interface MockAdset {
  id: string
  campaignId: string
  name: string
  status: string
  optimizationGoal: string
  advantagePlus: boolean
  learningStage: string
  ageMin: number
  ageMax: number
  genders: string
}
export interface MockAd {
  id: string
  adsetId: string
  name: string
  status: string
  creativeId: string
  /** Typical cost per lead and click-through for this ad (drives the daily numbers). */
  profile: { cpl: number; ctr: number; linkShare: number; weight: number }
}
export interface MockDay {
  adId: string
  date: string
  spend: number
  impressions: number
  reach: number
  clicks: number
  linkClicks: number
  leads: number
  comments: number
  pageLikes: number
  messages: number
  booked: number
  shown: number
  closed: number
  closedValue: number
  valueGenerated: number
}
export interface MockLead {
  id: string
  adId: string
  createdAt: string
  name: string
  email: string
  phone: string
  formId: string
}
export interface MockDataset {
  generatedFor: string
  employees: Employee[]
  clients: MockClient[]
  accounts: MockAccount[]
  campaigns: MockCampaign[]
  adsets: MockAdset[]
  ads: MockAd[]
  creatives: Creative[]
  days: MockDay[]
  leads: MockLead[]
  leadForms: { id: string; name: string; pageId: string; questions: string[]; contextCardTitle: string; thankYouTitle: string }[]
}

const EMPLOYEES: Employee[] = [
  { id: 'emp_alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', isAdManager: true, active: true },
  { id: 'emp_sam', firstName: 'Sam', lastName: 'Patel', email: 'sam@example.com', isAdManager: true, active: true },
  { id: 'emp_jo', firstName: 'Jo', lastName: 'Morgan', email: 'jo@example.com', isAdManager: true, active: true },
]

// [name, city, ad type, status, manager]
const GYMS: [string, string, string, MockClient['status'], string][] = [
  ['Northside Jiu Jitsu', 'Springfield', 'jiu jitsu beginners program', 'Active', 'emp_alex'],
  ['Harbor Yoga Studio', 'Bayview', 'yoga studio', 'Active', 'emp_sam'],
  ['Iron Lotus Muay Thai', 'Riverton', 'muay thai beginners program', 'Active', 'emp_jo'],
  ['Summit BJJ Academy', 'Lakeside', 'jiu jitsu kids program', 'Active', 'emp_alex'],
  ['Pulse Kickboxing', 'Maple Grove', 'kickboxing', 'Active', 'emp_sam'],
  ['Oakridge Martial Arts', 'Oakridge', 'jiu jitsu kids program', 'New', 'emp_jo'],
  ['Tidewater Grappling', 'Port Ellis', 'jiu jitsu beginners program', 'Active', 'emp_alex'],
  ['Lumen Hot Yoga', 'Cedar Falls', 'yoga studio', 'Active', 'emp_sam'],
  ['Granite Fight Club', 'Stoneville', 'kickboxing', 'Active', 'emp_jo'],
  ['Westend Jiu Jitsu', 'Westend', 'jiu jitsu beginners program', 'Active', 'emp_alex'],
  ['Bloom Boutique Fitness', 'Fairview', 'boutique fitness', 'New', 'emp_sam'],
  ['Valley Kids Karate', 'Green Valley', 'jiu jitsu kids program', 'Active', 'emp_jo'],
  ['Old Town Boxing', 'Oldtown', 'kickboxing', 'Inactive', 'emp_alex'],
]

const HOOKS = ['Free class', 'First week free', 'Kids confidence', 'Beginner friendly', 'No experience needed', 'Try it this week', 'Summer offer', 'Testimonial']
const FIRST = ['Taylor', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn', 'Jamie', 'Drew', 'Reese', 'Skyler', 'Parker']
const LAST = ['Smith', 'Nguyen', 'Garcia', 'Brown', 'Lee', 'Wilson', 'Martin', 'Clark', 'Lopez', 'Young']

/** A tiny SVG "creative" so the app has thumbnails without any external images. */
function placeholderImage(title: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},70%,25%)"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#g)"/><text x="200" y="190" font-family="Arial" font-size="34" font-weight="700" fill="white" text-anchor="middle">${title}</text>
<text x="200" y="240" font-family="Arial" font-size="20" fill="white" opacity=".85" text-anchor="middle">SAMPLE CREATIVE</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function generateMockData(today: string = todayInZone(), daysBack = 75): MockDataset {
  const rand = mulberry32(20261109)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const between = (a: number, b: number) => a + rand() * (b - a)

  const clients: MockClient[] = []
  const accounts: MockAccount[] = []
  const campaigns: MockCampaign[] = []
  const adsets: MockAdset[] = []
  const ads: MockAd[] = []
  const creatives: Creative[] = []
  const leadForms: MockDataset['leadForms'] = []

  GYMS.forEach(([name, city, adType, status, managerId], i) => {
    const clientId = 101 + i
    clients.push({
      id: clientId,
      name,
      status,
      managerId,
      city,
      leadsSheetUrl: `https://docs.google.com/spreadsheets/d/sample-${clientId}`,
    })
    const accountId = String(90000 + i * 17)
    // One unsettled account, one disabled account (for the account rules).
    const statusLabel = i === 4 ? 'UNSETTLED' : i === 9 ? 'DISABLED' : 'ACTIVE'
    accounts.push({ accountId, name, clientId, statusLabel, currency: i % 3 === 1 ? 'CAD' : 'USD' })
    const short = name.split(' ').map((w) => w[0]).join('')
    leadForms.push({
      id: `form_${clientId}`,
      name: `${short} | ${adType} | Lead form`,
      pageId: `page_${clientId}`,
      questions: ['Full name', 'Email', 'Phone number', adType.includes('kids') ? "Child's age" : 'Any experience?'],
      contextCardTitle: `Claim your free class at ${name}`,
      thankYouTitle: "You're in! We'll text you shortly.",
    })

    const nCampaigns = i % 4 === 0 ? 2 : 1
    for (let c = 0; c < nCampaigns; c++) {
      const campaignId = `${accountId}${c}`
      const program = c === 0 ? adType : 'retargeting'
      campaigns.push({
        id: campaignId,
        accountId,
        name: `${short} | ${program} | Leads`,
        status: c === 1 && i % 8 === 0 ? 'PAUSED' : 'ACTIVE',
        dailyBudget: Math.round(between(15, 45)),
        objective: 'OUTCOME_LEADS',
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      })
      const nAdsets = 1 + (rand() < 0.35 ? 1 : 0)
      for (let s = 0; s < nAdsets; s++) {
        const adsetId = `${campaignId}${s}`
        const ageMin = pick([18, 21, 25, 30])
        adsets.push({
          id: adsetId,
          campaignId,
          name: `${short} | ${s === 0 ? 'Broad' : 'Interests'} ${ageMin}-${ageMin + 30}`,
          status: 'ACTIVE',
          optimizationGoal: 'LEAD_GENERATION',
          advantagePlus: s === 0,
          learningStage: pick(['SUCCESS', 'SUCCESS', 'LEARNING', 'FAIL']),
          ageMin,
          ageMax: ageMin + 30,
          genders: adType.includes('yoga') ? 'Female' : 'All',
        })
        const nAds = 3
        for (let a = 0; a < nAds; a++) {
          const adId = `${adsetId}${a}`
          const hook = pick(HOOKS)
          const creativeId = `cr_${adId}`
          creatives.push({
            id: creativeId,
            name: `${short} ${hook}`,
            title: `${hook} at ${name}`,
            body: `Looking for ${adType.replace(' program', '')} in ${city}? ${hook.toLowerCase()} — no experience needed. Book your spot today.`,
            callToAction: pick(['SIGN_UP', 'LEARN_MORE', 'BOOK_NOW']),
            imageUrl: placeholderImage(hook, (i * 47 + a * 90) % 360),
            videoId: a === 2 ? `vid_${adId}` : null,
            videoThumbnailUrl: null,
            permalinkUrl: null,
          })
          // Base profile, then plant scenarios for the rules engine.
          let profile = { cpl: between(14, 38), ctr: between(1.1, 2.6), linkShare: between(0.45, 0.7), weight: between(0.6, 1.4) }
          if (i === 0 && c === 0 && s === 0 && a === 0) profile = { cpl: 95, ctr: 1.4, linkShare: 0.5, weight: 6 } // budget hog
          if (i === 2 && a === 1) profile = { ...profile, cpl: 120, weight: 0.9 } // expensive leads
          if (i === 6 && s === 0 && a === 2) profile = { ...profile, cpl: 9999, weight: 1.3 } // spend, no leads
          if (i === 7 && a === 0) profile = { ...profile, ctr: 0.55, linkShare: 0.5 } // low CTR + link CTR
          if (i === 10 && a === 1) profile = { ...profile, ctr: 1.2, linkShare: 0.3 } // low link CTR
          ads.push({
            id: adId,
            adsetId,
            name: `${short} | ${hook}${a === 2 ? ' (video)' : ''}`,
            status: a === 2 && i % 5 === 3 ? 'PAUSED' : 'ACTIVE',
            creativeId,
            profile,
          })
        }
      }
    }
  })

  // --- daily numbers ----------------------------------------------------------
  const days: MockDay[] = []
  const leads: MockLead[] = []
  const adById = new Map(ads.map((a) => [a.id, a]))
  const adsetById = new Map(adsets.map((s) => [s.id, s]))
  const campaignById = new Map(campaigns.map((c) => [c.id, c]))
  const accountById = new Map(accounts.map((a) => [a.accountId, a]))
  const clientById = new Map(clients.map((c) => [c.id, c]))

  const adsByAdset = new Map<string, MockAd[]>()
  for (const ad of ads) adsByAdset.set(ad.adsetId, [...(adsByAdset.get(ad.adsetId) ?? []), ad])

  for (let d = daysBack; d >= 0; d--) {
    const date = addDays(today, -d)
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay()
    const dayFactor = weekday === 0 || weekday === 6 ? 0.85 : 1.05
    for (const adset of adsets) {
      const campaign = campaignById.get(adset.campaignId)!
      const account = accountById.get(campaign.accountId)!
      const client = clientById.get(account.clientId)!
      const running =
        campaign.status === 'ACTIVE' &&
        account.statusLabel !== 'DISABLED' &&
        client.status !== 'Inactive' &&
        !(account.statusLabel === 'UNSETTLED' && d < 3) // unsettled: stopped spending recently
      if (!running) continue
      const live = (adsByAdset.get(adset.id) ?? []).filter((a) => a.status === 'ACTIVE')
      const totalWeight = live.reduce((s, a) => s + a.profile.weight, 0)
      const budget = (campaign.dailyBudget / campaigns.filter((c) => c.accountId === account.accountId).length) * dayFactor
      for (const ad of live) {
        const spend = Math.round(budget * (ad.profile.weight / totalWeight) * between(0.8, 1.2) * 100) / 100
        const cpm = between(9, 16)
        const impressions = Math.round((spend / cpm) * 1000)
        const reach = Math.round(impressions * between(0.7, 0.85))
        const clicks = Math.round(impressions * (ad.profile.ctr / 100) * between(0.85, 1.15))
        const linkClicks = Math.round(clicks * ad.profile.linkShare)
        const expected = spend / ad.profile.cpl
        const leadsToday = Math.floor(expected + rand()) // unbiased rounding
        const booked = Array.from({ length: leadsToday }, () => rand() < 0.45).filter(Boolean).length
        const shown = Array.from({ length: booked }, () => rand() < 0.6).filter(Boolean).length
        const closed = Array.from({ length: shown }, () => rand() < 0.45).filter(Boolean).length
        const closedValue = Math.round(closed * between(150, 300))
        days.push({
          adId: ad.id,
          date,
          spend,
          impressions,
          reach,
          clicks,
          linkClicks,
          leads: leadsToday,
          comments: rand() < 0.15 ? 1 : 0,
          pageLikes: rand() < 0.25 ? 1 : 0,
          messages: rand() < 0.1 ? 1 : 0,
          booked,
          shown,
          closed,
          closedValue,
          valueGenerated: closedValue + closed * Math.round(between(120, 200)) * Math.min(3, Math.floor(d / 30)),
        })
        for (let k = 0; k < leadsToday; k++) {
          const first = pick(FIRST)
          const last = pick(LAST)
          leads.push({
            id: `lead_${ad.id}_${date}_${k}`,
            adId: ad.id,
            createdAt: `${date}T${String(8 + Math.floor(rand() * 13)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00-05:00`,
            name: `${first} ${last}`,
            email: `${first}.${last}${Math.floor(rand() * 90 + 10)}@example.com`.toLowerCase(),
            phone: `555-01${String(Math.floor(rand() * 100)).padStart(2, '0')}`,
            formId: `form_${clientById.get(accountById.get(campaignById.get(adsetById.get(adById.get(ad.id)!.adsetId)!.campaignId)!.accountId)!.clientId)!.id}`,
          })
        }
      }
    }
  }

  return { generatedFor: today, employees: EMPLOYEES, clients, accounts, campaigns, adsets, ads, creatives, days, leads, leadForms }
}
