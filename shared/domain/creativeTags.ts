/**
 * Creative tags: what each ad offers, who it speaks to, and how it opens
 * (docs/creative-tags.md). Read by TypeSafe's Jev model from the ad's copy;
 * format (image or video) comes from Meta and needs no AI.
 *
 * The same lists drive the questions sent to Jev (supabase/functions/tag-creatives)
 * and the labels on the Insights "What's working" table.
 */

export interface TagOption {
  key: string
  label: string
  /** What Jev is told this option covers. */
  covers: string
}

export interface TagQuestion {
  key: 'offer' | 'audience' | 'hook'
  label: string
  instructions: string
  options: TagOption[]
}

export const TAG_QUESTIONS: TagQuestion[] = [
  {
    key: 'offer',
    label: 'Offer',
    instructions: 'What does this martial arts / fitness gym ad offer the reader?',
    options: [
      { key: 'free_trial', label: 'Free trial class', covers: 'One free class, free trial class, free intro lesson' },
      { key: 'free_week', label: 'Free week', covers: 'A free week, several free classes, free days or a free month' },
      { key: 'paid_intro', label: 'Paid intro or price', covers: 'A low-cost intro offer, a stated price, a discount or a deal on membership' },
      { key: 'seasonal', label: 'Seasonal or limited sale', covers: 'Black Friday, holiday, new year or another time-limited sale' },
      { key: 'no_offer', label: 'No clear offer', covers: 'No free class, price or deal is mentioned' },
    ],
  },
  {
    key: 'audience',
    label: 'Audience',
    instructions: 'Who is this ad mainly speaking to?',
    options: [
      { key: 'kids', label: 'Kids (parents)', covers: 'Children or parents of children, ages roughly 3 to 12' },
      { key: 'teens', label: 'Teens', covers: 'Teenagers or parents of teens, ages roughly 13 to 17' },
      { key: 'adults', label: 'Adults', covers: 'Adults in general, beginners, people getting fit' },
      { key: 'women', label: 'Women', covers: 'Women specifically, women-only classes or self-defense for women' },
      { key: 'families', label: 'Families', covers: 'Whole families training together, parent and child classes' },
    ],
  },
  {
    key: 'hook',
    label: 'Opening hook',
    instructions: 'How does the ad open? Judge the first line or two.',
    options: [
      { key: 'local_callout', label: 'Calls out a place or group', covers: 'Starts by naming a city, area or group, e.g. "HOWARD COUNTY PARENTS", "Renton adults"' },
      { key: 'pain_point', label: 'Problem or frustration', covers: 'Starts with a problem the reader has: bullying, low confidence, being out of shape, screen time' },
      { key: 'benefit', label: 'Result or benefit', covers: 'Starts with what they get: confidence, discipline, fitness, self-defense' },
      { key: 'urgency', label: 'Urgency or scarcity', covers: 'Starts with limited spots, a deadline or "last chance"' },
      { key: 'social_proof', label: 'Social proof', covers: 'Starts with reviews, testimonials, number of students or years open' },
      { key: 'question', label: 'Question', covers: 'Starts by asking the reader a question' },
    ],
  },
]

export type TagKey = TagQuestion['key']

/** Yes/no tags (asked as a two-option choice). */
export const FLAG_QUESTIONS = [
  { key: 'price', label: 'Mentions a price or saving', instructions: 'Does the ad mention a price, a discount, a dollar or percent saving, or a paid offer? A free class, free trial or free session on its own does not count.' },
  { key: 'deadline', label: 'Has a deadline or limited spots', instructions: 'Does the ad give a deadline, an end date, limited spots or a "last chance"?' },
  { key: 'place', label: 'Names the city or area', instructions: 'Does the ad name a specific city, town, neighbourhood or region?' },
  { key: 'uniform', label: 'Mentions a free uniform or gear', instructions: 'Does the ad mention a free or included uniform, gi or gear?' },
] as const
export type FlagKey = typeof FLAG_QUESTIONS[number]['key']

/** Bump when questions change: tag-creatives re-tags anything tagged with an older version. */
export const TAG_VERSION = 2

export type CreativeTags = Record<TagKey, string | null> & Record<FlagKey, boolean | null> & { confidence: Partial<Record<TagKey | FlagKey, number>> }

/** Text Jev reads for one creative. Empty when there's nothing to read. */
export function creativeText(c: { title?: string | null; body?: string | null }): string {
  const parts = [c.title && `Headline: ${c.title.trim()}`, c.body && `Primary text: ${c.body.trim()}`].filter(Boolean)
  return parts.join('\n\n').slice(0, 6000)
}

/** The request body for TypeSafe's System One API (POST /v1/systemone). */
export function jevRequest(state: string, model = 'jev-latest') {
  return {
    model,
    state,
    questions: {
      ...Object.fromEntries(TAG_QUESTIONS.map((q) => [q.key, {
        type: 'choice',
        instructions: q.instructions,
        criteria: Object.fromEntries(q.options.map((o) => [o.key, o.covers])),
      }])),
      ...Object.fromEntries(FLAG_QUESTIONS.map((q) => [q.key, {
        type: 'choice',
        instructions: q.instructions,
        criteria: { yes: 'Yes, the ad clearly does this', no: 'No, it does not' },
      }])),
    },
  }
}

/**
 * Reads Jev's answer. Answers are keyed by question name, either at the top
 * level or under "answers"; each choice answer has "choice" and "confidence".
 * Unknown or missing answers become null, never a guess.
 */
export function parseJevAnswer(raw: unknown): CreativeTags {
  const root = (raw ?? {}) as Record<string, unknown>
  const answers = (root.answers && typeof root.answers === 'object' ? root.answers : root) as Record<string, unknown>
  const out = { confidence: {} } as CreativeTags
  for (const q of TAG_QUESTIONS) {
    const a = answers[q.key] as { choice?: unknown; confidence?: unknown } | undefined
    const choice = typeof a?.choice === 'string' && q.options.some((o) => o.key === a.choice) ? a.choice : null
    out[q.key] = choice
    if (choice && typeof a?.confidence === 'number') out.confidence[q.key] = a.confidence
  }
  for (const q of FLAG_QUESTIONS) {
    const a = answers[q.key] as { choice?: unknown; confidence?: unknown } | undefined
    out[q.key] = a?.choice === 'yes' ? true : a?.choice === 'no' ? false : null
    if (out[q.key] !== null && typeof a?.confidence === 'number') out.confidence[q.key] = a.confidence
  }
  return out
}

export const tagLabel = (key: string, value: string | null): string => {
  if (key === 'format') return value === 'video' ? 'Video' : value === 'image' ? 'Image' : 'Unknown'
  return TAG_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.key === value)?.label ?? 'Not tagged'
}

// ---------------------------------------------------------------------------
// Insights: labels, filters and summaries for ads (docs/creative-tags.md)

export type AdTags = Record<TagKey, string | null> & Record<FlagKey, boolean | null>

export interface TagFilter {
  offer?: string
  audience?: string
  hook?: string
  /** Yes/no tags that must be true. */
  flags?: FlagKey[]
}

export const filterIsEmpty = (f: TagFilter) => !f.offer && !f.audience && !f.hook && !(f.flags?.length)

export function matchesTagFilter(t: AdTags | null | undefined, f: TagFilter): boolean {
  if (filterIsEmpty(f)) return true
  if (!t) return false
  if (f.offer && t.offer !== f.offer) return false
  if (f.audience && t.audience !== f.audience) return false
  if (f.hook && t.hook !== f.hook) return false
  return (f.flags ?? []).every((k) => t[k] === true)
}

const SHORT_FLAG: Record<FlagKey, string> = { price: 'Price', deadline: 'Deadline', place: 'City', uniform: 'Uniform' }

/** Short labels for chips and summaries (the full ones are used in What's working). */
const SHORT: Record<string, string> = {
  free_trial: 'Free trial', free_week: 'Free week', paid_intro: 'Paid intro', seasonal: 'Seasonal', no_offer: 'No offer',
  kids: 'Kids', teens: 'Teens', adults: 'Adults', women: 'Women', families: 'Families',
  local_callout: 'Place callout', pain_point: 'Problem', benefit: 'Benefit', urgency: 'Urgency', social_proof: 'Social proof', question: 'Question',
}
export const shortTag = (value: string) => SHORT[value] ?? value

/** Short labels for one ad, in reading order: offer, audience, hook, then yes/no tags that are true. */
export function tagChips(t: AdTags | null | undefined): string[] {
  if (!t) return []
  const out: string[] = []
  for (const q of TAG_QUESTIONS) {
    const v = t[q.key]
    if (v && v !== 'no_offer') out.push(shortTag(v))
  }
  for (const q of FLAG_QUESTIONS) if (t[q.key]) out.push(SHORT_FLAG[q.key])
  return out
}

/** "4 ads: 3 free trial, 1 seasonal · kids" for a campaign or ad set. */
export function summariseTags(list: (AdTags | null | undefined)[]): string | null {
  const tagged = list.filter((t): t is AdTags => !!t)
  if (!tagged.length) return null
  const top = (key: TagKey) => {
    const counts = new Map<string, number>()
    for (const t of tagged) if (t[key] && t[key] !== 'no_offer') counts.set(t[key]!, (counts.get(t[key]!) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }
  const offers = top('offer').map(([v, n]) => `${n} ${shortTag(v).toLowerCase()}`)
  const audiences = top('audience').slice(0, 2).map(([v]) => shortTag(v).toLowerCase())
  const head = `${tagged.length} ad${tagged.length === 1 ? '' : 's'}`
  return [offers.length ? `${head}: ${offers.join(', ')}` : head, audiences.join(', ')].filter(Boolean).join(' · ')
}

/**
 * Headline and primary text of a Meta creative. Meta leaves `title`/`body`
 * empty for some ads and keeps the text in the post spec or, for ads with
 * several texts, in the asset feed; use those when the plain fields are empty.
 */
export function creativeCopy(c: Record<string, unknown>): { title: string | null; body: string | null; videoId: string | null } {
  const spec = (c.object_story_spec ?? {}) as { link_data?: { message?: string; name?: string }; video_data?: { message?: string; title?: string; video_id?: string } }
  const feed = (c.asset_feed_spec ?? {}) as { bodies?: { text?: string }[]; titles?: { text?: string }[]; videos?: { video_id?: string }[] }
  const first = (...xs: (string | undefined | null)[]) => xs.find((x) => typeof x === 'string' && x.trim())?.trim() ?? null
  return {
    title: first(c.title as string, spec.link_data?.name, spec.video_data?.title, feed.titles?.[0]?.text),
    body: first(c.body as string, spec.link_data?.message, spec.video_data?.message, feed.bodies?.[0]?.text),
    videoId: first(c.video_id as string, spec.video_data?.video_id, feed.videos?.[0]?.video_id),
  }
}
