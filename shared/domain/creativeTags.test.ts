import { describe, expect, it } from 'vitest'
import { creativeText, jevRequest, parseJevAnswer, tagLabel } from './creativeTags.ts'

describe('creative tags', () => {
  it('builds one System One request with a choice question per tag', () => {
    const r = jevRequest('Headline: Free week')
    expect(r.model).toBe('jev-latest')
    expect(Object.keys(r.questions)).toEqual(['offer', 'audience', 'hook'])
    expect(r.questions.offer.type).toBe('choice')
    expect(r.questions.offer.criteria.free_week).toContain('free week')
  })
  it('reads answers at the top level or under "answers"', () => {
    const a = { offer: { type: 'choice', choice: 'free_trial', confidence: 0.91 }, audience: { choice: 'kids' }, hook: { choice: 'made_up' } }
    expect(parseJevAnswer(a)).toEqual({ offer: 'free_trial', audience: 'kids', hook: null, confidence: { offer: 0.91 } })
    expect(parseJevAnswer({ answers: a }).offer).toBe('free_trial')
    expect(parseJevAnswer(null)).toEqual({ offer: null, audience: null, hook: null, confidence: {} })
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
