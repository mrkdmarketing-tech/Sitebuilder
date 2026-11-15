import { describe, expect, it } from 'vitest'
import { creativeText, jevRequest, parseJevAnswer, tagLabel } from './creativeTags.ts'

describe('creative tags', () => {
  it('builds one System One request with a choice question per tag', () => {
    const r = jevRequest('Headline: Free week')
    expect(r.model).toBe('jev-latest')
    expect(Object.keys(r.questions)).toEqual(['offer', 'audience', 'hook', 'price', 'deadline', 'place', 'uniform'])
    expect(r.questions.price.criteria).toHaveProperty('yes')
    expect(r.questions.offer.type).toBe('choice')
    expect((r.questions.offer.criteria as Record<string, string>).free_week).toContain('free week')
  })
  it('reads answers at the top level or under "answers"', () => {
    const a = { offer: { type: 'choice', choice: 'free_trial', confidence: 0.91 }, audience: { choice: 'kids' }, hook: { choice: 'made_up' } }
    const none = { price: null, deadline: null, place: null, uniform: null }
    expect(parseJevAnswer(a)).toEqual({ offer: 'free_trial', audience: 'kids', hook: null, ...none, confidence: { offer: 0.91 } })
    expect(parseJevAnswer({ answers: a }).offer).toBe('free_trial')
    expect(parseJevAnswer(null)).toEqual({ offer: null, audience: null, hook: null, ...none, confidence: {} })
    expect(parseJevAnswer({ price: { choice: 'yes', confidence: 0.9 }, place: { choice: 'no' } })).toMatchObject({ price: true, place: false, deadline: null })
  })
  it('joins headline and primary text', () => {
    expect(creativeText({ title: ' Free week ', body: 'Kids jiu jitsu' })).toBe('Headline: Free week\n\nPrimary text: Kids jiu jitsu')
    expect(creativeText({})).toBe('')
  })
  it('labels', () => {
    expect(tagLabel('offer', 'free_week')).toBe('Free week')
    expect(tagLabel('format', 'video')).toBe('Video')
    expect(tagLabel('hook', null)).toBe('Not tagged')
  })
})

describe('Insights tag helpers', () => {
  const t = { offer: 'free_trial', audience: 'kids', hook: 'local_callout', price: false, deadline: true, place: true, uniform: null }
  it('labels an ad', async () => {
    const { tagChips } = await import('./creativeTags.ts')
    expect(tagChips(t)).toEqual(['Free trial', 'Kids', 'Place callout', 'Deadline', 'City'])
    expect(tagChips(null)).toEqual([])
  })
  it('filters', async () => {
    const { matchesTagFilter } = await import('./creativeTags.ts')
    expect(matchesTagFilter(t, {})).toBe(true)
    expect(matchesTagFilter(null, {})).toBe(true)
    expect(matchesTagFilter(t, { offer: 'free_trial', flags: ['deadline'] })).toBe(true)
    expect(matchesTagFilter(t, { flags: ['price'] })).toBe(false)
    expect(matchesTagFilter(null, { audience: 'kids' })).toBe(false)
  })
  it('summarises a campaign', async () => {
    const { summariseTags } = await import('./creativeTags.ts')
    expect(summariseTags([t, t, { ...t, offer: 'seasonal', audience: 'adults' }, null]))
      .toBe('3 ads: 2 free trial, 1 seasonal · kids, adults')
    expect(summariseTags([null])).toBeNull()
  })
})

describe('creative copy', () => {
  it('falls back to the post spec and the asset feed', async () => {
    const { creativeCopy } = await import('./creativeTags.ts')
    expect(creativeCopy({ title: 'T', body: 'B' })).toEqual({ title: 'T', body: 'B', videoId: null })
    expect(creativeCopy({ object_story_spec: { video_data: { message: 'Kids class', title: 'Free trial', video_id: '9' } } }))
      .toEqual({ title: 'Free trial', body: 'Kids class', videoId: '9' })
    expect(creativeCopy({ asset_feed_spec: { bodies: [{ text: 'First' }, { text: 'Second' }], titles: [{ text: 'Head' }] } }))
      .toEqual({ title: 'Head', body: 'First', videoId: null })
  })
})
