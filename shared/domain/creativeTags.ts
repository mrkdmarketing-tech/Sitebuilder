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
export type CreativeTags = Record<TagKey, string | null> & { confidence: Partial<Record<TagKey, number>> }

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
    questions: Object.fromEntries(TAG_QUESTIONS.map((q) => [q.key, {
      type: 'choice',
      instructions: q.instructions,
      criteria: Object.fromEntries(q.options.map((o) => [o.key, o.covers])),
    }])),
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
  return out
}

export const tagLabel = (key: string, value: string | null): string => {
  if (key === 'format') return value === 'video' ? 'Video' : value === 'image' ? 'Image' : 'Unknown'
  return TAG_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.key === value)?.label ?? 'Not tagged'
}
