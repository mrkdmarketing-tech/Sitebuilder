/**
 * Built-in mistake checks for ad approval (docs/ad-approval.md#built-in-checks).
 * Instant, free, no AI: run in the browser as people type and on the server
 * (ad-check) when an ad is submitted. The Claude check adds reading the text in
 * images and videos and anything subtler.
 *
 * Checks:
 *  - Wrong discipline: e.g. "Muay Thai" in a jiu jitsu ad.
 *  - Phone number or street number that doesn't match the client.
 *  - Another client's name, or another client's city.
 *  - A weekday that doesn't match the date ("Monday, November 12" in a year where it's a Thursday).
 *  - Template placeholders left in ({{ offer }}).
 *  - Common misspellings (incl. martial-arts terms) and repeated words.
 */
import { isMetaMacro, type CheckableText, type RawFinding } from './approvals.ts'

export interface QuickCheckInput {
  texts: CheckableText[]
  client: {
    name: string | null
    city?: string | null
    state?: string | null
    address?: string | null
    /** Every number known to be the client's (business phone, contact phone...). */
    phones?: (string | null | undefined)[]
    /** Extra words about the client: programs, ad types, onboarding answers, area callouts. */
    about?: (string | null | undefined)[]
  }
  /** The ad type chosen for this ad, e.g. "jiu jitsu kids program". */
  adType?: string | null
  /** Other clients (to spot copy-paste from another location's ad). */
  otherClients?: { name: string | null; city?: string | null }[]
  today?: Date
}

// ---------------------------------------------------------------------------
// Disciplines

export const DISCIPLINES: { key: string; label: string; re: RegExp }[] = [
  { key: 'bjj', label: 'jiu jitsu', re: /\b(brazilian\s+)?ji?u[\s-]?ji?tsu\b|\bjiujitsu\b|\bjui[\s-]?jitsu\b|\bbjj\b|\bgrappling\b|\bgracie\b/i },
  { key: 'muay_thai', label: 'Muay Thai', re: /\bmuay?[\s-]?th?ai\b|\bthai[\s-]?boxing\b/i },
  { key: 'kickboxing', label: 'kickboxing', re: /\bkick[\s-]?boxing\b/i },
  { key: 'boxing', label: 'boxing', re: /(?<!kick[\s-]?)(?<!thai[\s-]?)\bboxing\b/i },
  { key: 'karate', label: 'karate', re: /\bkarate\b/i },
  { key: 'taekwondo', label: 'taekwondo', re: /\btae[\s-]?kwon[\s-]?do\b/i },
  { key: 'judo', label: 'judo', re: /\bjudo\b/i },
  { key: 'wrestling', label: 'wrestling', re: /\bwrestling\b/i },
  { key: 'krav_maga', label: 'Krav Maga', re: /\bkrav[\s-]?maga\b/i },
  { key: 'yoga', label: 'yoga', re: /\byoga\b/i },
  { key: 'baseball', label: 'baseball/softball', re: /\b(baseball|softball)\b/i },
]
const GRAPPLING = new Set(['bjj', 'wrestling', 'judo'])
/** Words that mean a client teaches several disciplines, so a mention isn't a mistake. */
const MULTI = /\b(mma|mixed martial arts|martial arts|fight (club|team)|combat sports?)\b/i

export function disciplinesIn(text: string): Set<string> {
  const found = new Set<string>()
  for (const d of DISCIPLINES) if (d.re.test(text)) found.add(d.key)
  return found
}
const label = (key: string) => DISCIPLINES.find((d) => d.key === key)?.label ?? key

// ---------------------------------------------------------------------------
// Misspellings: wrong -> right (whole words/phrases, case-insensitive)

export const MISSPELLINGS: Record<string, string> = {
  'jui jitsu': 'jiu jitsu', 'jui-jitsu': 'jiu-jitsu', 'jiu jitsue': 'jiu jitsu', 'jiu jutsu': 'jiu jitsu', 'jiu jitzu': 'jiu jitsu',
  'ju jitsu': 'jiu jitsu', 'jujitsu': 'jiu jitsu',
  'muy thai': 'Muay Thai', 'muay tai': 'Muay Thai', 'mauy thai': 'Muay Thai',
  'grappeling': 'grappling', 'begginer': 'beginner', 'begginers': 'beginners', 'beginers': 'beginners',
  'excercise': 'exercise', 'recieve': 'receive', 'seperate': 'separate', 'definately': 'definitely', 'tomorow': 'tomorrow',
  'untill': 'until', 'thier': 'their', 'occured': 'occurred', 'accomodate': 'accommodate', 'calender': 'calendar',
  'schedual': 'schedule', 'scheduel': 'schedule', 'confidance': 'confidence', 'dicipline': 'discipline', 'disipline': 'discipline',
  'free trail': 'free trial', 'childrens': "children's", 'garanteed': 'guaranteed', 'limted': 'limited', 'availible': 'available',
  'familys': 'families', 'instuctor': 'instructor', 'instructer': 'instructor', 'tecnique': 'technique', 'techinque': 'technique',
  'comunity': 'community', 'excellant': 'excellent', 'sucess': 'success', 'succesful': 'successful', 'neccessary': 'necessary',
  'beleive': 'believe', 'achive': 'achieve', 'alot': 'a lot', 'loose weight': 'lose weight', 'your welcome': "you're welcome", 'oppurtunity': 'opportunity', 'opportunty': 'opportunity', 'aswell': 'as well',
}
// "ju jitsu" and "jujitsu" are real (Japanese jujutsu), so for BJJ gyms only suggest, as a warning.
const SOFT_SPELLING = new Set(['ju jitsu', 'jujitsu'])

// ---------------------------------------------------------------------------
// Helpers

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
const last10 = (s: string) => digits(s).slice(-10)
const fmtPhone = (s: string) => {
  const d = last10(s)
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s
}
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRe = (phrase: string) => new RegExp(`(?<![a-z])${escapeRe(phrase).replace(/\s+/g, '[\\s-]+')}(?![a-z])`, 'i')

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g
// The words between the number and "St" can't be plain numbers, so "555-9999 or visit 99 Main St" finds "99 Main St".
const STREET_RE = /\b(\d{1,6})\s+(?:(?!\d+\s)[A-Za-z0-9.'-]+\s+){0,4}?(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|crescent|cres|place|pl|parkway|pkwy|highway|hwy|circle|cir|terrace|trail|pike|square|sq)\b\.?/gi
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DATE_RE = /\b(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?\.?,?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi
/** Cities that are also ordinary words: too likely to be a false alarm. */
const CITY_STOPWORDS = new Set(['sterling', 'hickory', 'independence', 'union', 'liberty', 'temple', 'surprise', 'mission', 'orange', 'victoria', 'franklin', 'lincoln', 'clinton', 'jackson', 'madison', 'washington', 'columbia', 'aurora', 'summit', 'marion'])

// ---------------------------------------------------------------------------

/** The client details the checks use, from the client brief (client_brief / ds.approvals.brief). */
export function checkClient(brief: {
  businessName: string | null
  placeholders?: Record<string, string | null | undefined> | null
  facts?: { label: string; value: string }[] | null
  onboarding?: unknown
  campaign?: unknown
} | null | undefined): QuickCheckInput['client'] {
  const ph = brief?.placeholders ?? {}
  const factValues = (brief?.facts ?? []).map((f) => f.value)
  return {
    name: brief?.businessName ?? null, city: ph.city, state: ph.state, address: ph.address,
    phones: [ph.phone, ...factValues.filter((v) => /^\+?[\d\s().-]{10,}$/.test(v ?? ''))],
    about: [ph.programs, ph.offer, ph.area_callouts, JSON.stringify(brief?.onboarding ?? {}), JSON.stringify(brief?.campaign ?? {})],
  }
}

export function quickChecks(input: QuickCheckInput): RawFinding[] {
  const out: RawFinding[] = []
  const add = (t: CheckableText, f: Omit<RawFinding, 'field' | 'location' | 'assetNumber'>) =>
    out.push({ field: t.field, location: null, assetNumber: null, ...f })
  const clientName = input.client.name ?? 'this client'

  // --- Disciplines
  const clientText = [input.client.name, ...(input.client.about ?? [])].filter(Boolean).join(' ')
  const adTypeD = disciplinesIn(input.adType ?? '')
  const multi = MULTI.test(clientText)
  const clientD = multi ? new Set<string>() : disciplinesIn(clientText)
  // What the ad may mention: the ad type's discipline plus whatever the client is known to teach.
  const allowed = new Set([...adTypeD, ...clientD])
  const allowedWhy = adTypeD.size ? `this is a ${[...adTypeD].map(label).join(' / ')} ad` : `${clientName} is a ${[...clientD].map(label).join(' / ')} gym`

  // --- Phone and address
  const knownPhones = new Set((input.client.phones ?? []).map((p) => last10(p ?? '')).filter((p) => p.length === 10))
  const addressNumbers = new Set((input.client.address ?? '').match(/\d+/g) ?? [])
  const clientPlace = norm([input.client.city, input.client.state, input.client.address, input.client.name, ...(input.client.about ?? [])].join(' '))
  const others = (input.otherClients ?? []).filter((o) => norm(o.name) && norm(o.name) !== norm(input.client.name))
  const today = input.today ?? new Date()

  for (const t of input.texts) {
    const text = t.text
    // Links (thank-you page, privacy policy, URL tags) can say anything: only check them for placeholders.
    const isLink = /url|urlparameters/i.test(t.field)
    // Prose with web addresses blanked out, for the word checks.
    const prose = isLink ? '' : text.replace(/https?:\/\/\S+|www\.\S+/gi, (u) => ' '.repeat(u.length))

    // Wrong discipline
    if (allowed.size) {
      for (const d of disciplinesIn(prose)) {
        if (allowed.has(d)) continue
        if (d === 'boxing' && (allowed.has('kickboxing') || allowed.has('muay_thai'))) continue
        // Grappling styles go together: jiu jitsu gyms often mention wrestling or judo.
        if (GRAPPLING.has(d) && [...allowed].some((a) => GRAPPLING.has(a))) continue
        const m = prose.match(DISCIPLINES.find((x) => x.key === d)!.re)
        add(t, {
          // Gyms that teach several things (MMA...) might mention another class on purpose.
          category: 'mismatch', severity: multi ? 'warning' : 'error', excerpt: m?.[0] ?? label(d),
          message: `Mentions ${label(d)}, but ${allowedWhy}.`, suggestion: null,
        })
      }
    }

    // Phone numbers
    if (knownPhones.size) {
      for (const m of prose.matchAll(PHONE_RE)) {
        const p = last10(m[0])
        if (p.length === 10 && !knownPhones.has(p)) {
          add(t, {
            category: 'mismatch', severity: 'warning', excerpt: m[0].trim(),
            message: `This phone number isn't the one on file for ${clientName}. If their number changed, update it in GHL.`, suggestion: fmtPhone([...knownPhones][0]),
          })
        }
      }
    }

    // Street address
    if (addressNumbers.size) {
      for (const m of prose.matchAll(STREET_RE)) {
        if (!addressNumbers.has(m[1])) {
          add(t, {
            category: 'mismatch', severity: 'warning', excerpt: m[0].trim(),
            message: `This address doesn't match the one on file for ${clientName} (${input.client.address}). If they moved, update it in GHL.`, suggestion: null,
          })
        }
      }
    }

    // Another client's name or city
    const n = norm(prose)
    for (const o of others) {
      const on = norm(o.name)
      if (on.length >= 8 && !clientPlace.includes(on) && wordRe(on).test(n)) {
        add(t, {
          category: 'mismatch', severity: 'error', excerpt: o.name ?? '',
          message: `Mentions ${o.name}, another client. Copied from their ad?`, suggestion: input.client.name ?? null,
        })
      }
      const city = norm(o.city)
      if (city.length >= 4 && !CITY_STOPWORDS.has(city) && !clientPlace.includes(city) && wordRe(city).test(n)) {
        add(t, {
          category: 'mismatch', severity: 'warning', excerpt: o.city ?? '',
          message: `Mentions ${o.city}, but ${clientName} is in ${input.client.city ?? 'another city'}.`, suggestion: input.client.city ?? null,
        })
      }
    }

    // Weekday vs date
    for (const m of prose.matchAll(DATE_RE)) {
      const said = DAYS.findIndex((d) => d.startsWith(m[1].toLowerCase().slice(0, 3)))
      const month = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3))
      const day = Number(m[3])
      let year = today.getFullYear()
      let date = new Date(Date.UTC(year, month, day))
      if (date.getTime() < today.getTime() - 60 * 86_400_000) date = new Date(Date.UTC(++year, month, day))
      if (date.getUTCMonth() !== month) {
        add(t, { category: 'logic', severity: 'error', excerpt: m[0], message: `${m[2]} ${day} doesn't exist.`, suggestion: null })
      } else if (said >= 0 && date.getUTCDay() !== said) {
        const real = DAYS[date.getUTCDay()]
        add(t, {
          category: 'logic', severity: 'error', excerpt: m[0],
          message: `${m[2]} ${day}, ${year} is a ${real[0].toUpperCase()}${real.slice(1)}, not a ${DAYS[said][0].toUpperCase()}${DAYS[said].slice(1)}.`,
          suggestion: null,
        })
      }
    }

    // Placeholders left in
    for (const m of text.matchAll(/\{\{([^}]*)\}\}/g)) {
      if (isMetaMacro(m[1])) continue
      add(t, { category: 'other', severity: 'error', excerpt: m[0], message: 'A template placeholder was left in. Replace it with the real text.', suggestion: null })
    }

    // Misspellings
    for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
      const m = prose.match(wordRe(wrong))
      if (!m) continue
      const soft = SOFT_SPELLING.has(wrong)
      if (soft && !(allowed.has('bjj') || clientD.has('bjj'))) continue
      add(t, {
        category: 'spelling', severity: soft ? 'warning' : 'error', excerpt: m[0],
        message: soft ? `"${m[0]}" is usually written "${right}" for a jiu jitsu gym.` : `"${m[0]}" looks misspelled.`,
        suggestion: right,
      })
    }

    // Repeated words ("the the")
    for (const m of prose.matchAll(/\b([a-z]{2,})\s+\1\b/gi)) {
      if (['that', 'had', 'very', 'bye', 'no', 'ha'].includes(m[1].toLowerCase())) continue
      add(t, { category: 'grammar', severity: 'warning', excerpt: m[0], message: `"${m[1]}" is repeated.`, suggestion: m[1] })
    }
  }

  // One finding per field + text + kind.
  const seen = new Set<string>()
  return out.filter((f) => {
    const k = `${f.field}|${f.category}|${f.excerpt.toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
