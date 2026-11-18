/**
 * Ad Studio: MRKD's approved ad styles, made from a form in ad approval
 * (docs/ad-studio.md). Each style's rules come from its BUILD.md in the MRKD
 * style kit; the kit's own Python renders the ad (in the browser, Pyodide), so
 * the look is exactly the approved one.
 *
 * Pilot: EC Echo (adults split, config-driven).
 */

export type GymType = 'gracie-barra' | 'generic'

export interface EchoAd {
  /** File name without "-cutout.png", from the kit's people folder. */
  person: string
  palette: 'cream' | 'charcoal' | 'navy' | 'red'
  treat: 'color' | 'mono'
  /** Person on the left, text on the right. */
  flip: boolean
}

export interface EchoConfig {
  slug: string
  gym_type: GymType
  brand: string
  kicker: string
  echo: [string, string] | [string]
  details: [string, string]
  small: [string, string]
  rail: [string, string, string]
  corner: string
  button: string
  ads: (EchoAd & { name: string })[]
}

/** The editable text of an Echo ad (what the form shows). */
export interface EchoText {
  brand: string
  kicker: string
  echo1: string
  echo2: string
  details1: string
  details2: string
  small1: string
  small2: string
  railTop: string
  railMiddle: string
  railCode: string
  corner: string
  button: string
}

export const ECHO_FIELDS: { key: keyof EchoText; label: string; hint?: string }[] = [
  { key: 'brand', label: 'Gym name line', hint: 'Small line at the top, e.g. GRACIE BARRA OTTAWA' },
  { key: 'kicker', label: 'Kicker', hint: 'JIU JITSU / KICKBOXING / BEGINNERS / REST OF THE YEAR' },
  { key: 'echo1', label: 'Big line 1', hint: 'Short: 1 to 6 characters works best (FREE, 50%, SAVE)' },
  { key: 'echo2', label: 'Big line 2', hint: 'TRIAL, OFF, $300 (or leave empty)' },
  { key: 'details1', label: 'Details line 1' },
  { key: 'details2', label: 'Details line 2' },
  { key: 'small1', label: 'Small line 1', hint: 'e.g. NO EXPERIENCE NEEDED' },
  { key: 'small2', label: 'Small line 2', hint: 'e.g. UNIFORM INCLUDED' },
  { key: 'railTop', label: 'Side rail: place', hint: 'e.g. MID CITIES' },
  { key: 'railMiddle', label: 'Side rail: middle', hint: 'e.g. ALL LEVELS' },
  { key: 'railCode', label: 'Side rail: short code', hint: '2 to 3 letters, e.g. D5, GBO' },
  { key: 'corner', label: 'Corner word', hint: 'ADULTS' },
  { key: 'button', label: 'Button', hint: 'BOOK YOUR FREE TRIAL' },
]

export const ECHO_PALETTES: EchoAd['palette'][] = ['cream', 'charcoal', 'navy', 'red']

/** Shipped starting points (code/configs in the kit). */
export const ECHO_STARTERS: { file: string; label: string; blackFriday?: boolean; gb?: boolean }[] = [
  { file: 'jiu-jitsu-free-trial-double-five.json', label: 'Beginners free trial (any gym)' },
  { file: 'gb-rest-of-year.json', label: 'Rest of the year / save (Gracie Barra)', gb: true },
  { file: 'apex-kickboxing-free-class.json', label: 'Kickboxing free class (any gym)' },
  { file: 'gb-ottawa-black-friday.json', label: 'Black Friday (only for a real Black Friday offer)', gb: true, blackFriday: true },
]

export const isGracieBarra = (name: string | null | undefined) => /gracie\s*barra|^gb\b/i.test(name ?? '')

const up = (s: string | null | undefined) => (s ?? '').trim().toUpperCase()

/** Initials for the rail code, e.g. "Gracie Barra Ottawa" -> "GBO", "Double Five Mid-Cities" -> "DFM". */
export function railCode(name: string): string {
  return name.replace(/[^A-Za-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join('').toUpperCase()
}

/** Form text from a starter config, with the client's own name and place filled in. */
export function echoTextFrom(starter: Partial<EchoConfig>, client: { name: string; city?: string | null }): EchoText {
  return {
    brand: up(client.name),
    kicker: starter.kicker ?? '',
    echo1: starter.echo?.[0] ?? '',
    echo2: starter.echo?.[1] ?? '',
    details1: starter.details?.[0] ?? '',
    details2: starter.details?.[1] ?? '',
    small1: starter.small?.[0] ?? '',
    small2: starter.small?.[1] ?? '',
    railTop: up(client.city) || (starter.rail?.[0] ?? ''),
    railMiddle: starter.rail?.[1] ?? 'ALL LEVELS',
    railCode: railCode(client.name),
    corner: starter.corner ?? 'ADULTS',
    button: starter.button ?? 'BOOK YOUR FREE TRIAL',
  }
}

/** People this gym may use: GB people (GB patches) only for Gracie Barra; everyone else the generic ones. */
export function echoPeopleFor(all: string[], gym: GymType): string[] {
  return all.filter((p) => (gym === 'gracie-barra' ? p.startsWith('gb-') || p.includes('kickboxing') : p.startsWith('generic-')))
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'echo'
}

export function buildEchoConfig(text: EchoText, gym: GymType, ads: EchoAd[]): EchoConfig {
  const t = (s: string) => s.trim().toUpperCase()
  const echo = [t(text.echo1), t(text.echo2)].filter(Boolean)
  return {
    slug: slugify(text.brand),
    gym_type: gym,
    brand: t(text.brand),
    kicker: t(text.kicker),
    echo: (echo.length ? echo : ['']) as EchoConfig['echo'],
    details: [t(text.details1), t(text.details2)],
    small: [t(text.small1), t(text.small2)],
    rail: [t(text.railTop), t(text.railMiddle), t(text.railCode)],
    corner: t(text.corner) || 'ADULTS',
    button: t(text.button) || 'BOOK YOUR FREE TRIAL',
    ads: ads.map((a, i) => ({ ...a, name: `${a.palette}-${a.person.replace(/^(gb|generic)-/, '').split('-').slice(0, 2).join('-')}${a.flip ? '-left' : ''}-${i + 1}` })),
  }
}

export interface StudioProblem {
  field?: keyof EchoText | 'ads'
  severity: 'error' | 'warning'
  message: string
}

/** The kit's house rules for Echo, checked before rendering. Errors block; warnings ask for a second look. */
export function checkEcho(text: EchoText, gym: GymType, ads: EchoAd[], opts: { blackFridayOffer: boolean }): StudioProblem[] {
  const out: StudioProblem[] = []
  const need: (keyof EchoText)[] = ['brand', 'kicker', 'echo1', 'details1', 'button']
  for (const k of need) if (!text[k].trim()) out.push({ field: k, severity: 'error', message: 'Needed.' })
  for (const k of ['echo1', 'echo2'] as const) {
    if (text[k].trim().length > 6) out.push({ field: k, severity: 'warning', message: 'Long for a big line: 1 to 6 characters looks best.' })
  }
  const all = Object.values(text).join(' ')
  if (/black\s*friday/i.test(all) && !opts.blackFridayOffer) {
    out.push({ severity: 'error', message: 'Only say "Black Friday" for a real Black Friday offer. Tick the box if this client runs one.' })
  }
  if (!ads.length) out.push({ field: 'ads', severity: 'error', message: 'Pick at least one person.' })
  if (ads.length > 6) out.push({ field: 'ads', severity: 'error', message: 'Up to 6 ads at a time.' })
  for (const a of ads) {
    if (gym === 'generic' && a.person.startsWith('gb-')) {
      out.push({ field: 'ads', severity: 'error', message: 'That person wears Gracie Barra patches: only for Gracie Barra gyms.' })
    }
  }
  if (/\$\s?\d|\d+\s?%/.test(all)) {
    out.push({ severity: 'warning', message: 'Has a price or saving: make sure it is this client\'s real offer.' })
  }
  return out
}

/** Text the mistake checks read (field names match the form). */
export const echoCheckTexts = (text: EchoText) =>
  ECHO_FIELDS.map((f) => ({ field: `studio.${f.key}`, label: f.label, text: text[f.key] })).filter((t) => t.text.trim())
