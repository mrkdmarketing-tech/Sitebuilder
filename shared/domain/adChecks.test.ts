import { describe, expect, it } from 'vitest'
import { disciplinesIn, quickChecks, type QuickCheckInput } from './adChecks.ts'

const t = (text: string, field = 'creative.primaryText') => ({ field, label: 'Primary text', text })
const renton: QuickCheckInput['client'] = {
  name: 'Gracie Barra Renton', city: 'Renton', state: 'WA', address: '4300 NE 4th St', phones: ['+14255551234'],
}
const run = (text: string, extra: Partial<QuickCheckInput> = {}) =>
  quickChecks({ texts: [t(text)], client: renton, today: new Date('2026-11-11T12:00:00Z'), ...extra })

describe('disciplines', () => {
  it('recognises the common ones', () => {
    expect([...disciplinesIn('Brazilian Jiu-Jitsu for kids')]).toEqual(['bjj'])
    expect([...disciplinesIn('Muay Thai and kickboxing')].sort()).toEqual(['kickboxing', 'muay_thai'])
    expect([...disciplinesIn('kickboxing')]).toEqual(['kickboxing']) // not also "boxing"
  })
  it('flags the wrong discipline for a jiu jitsu gym', () => {
    const f = run('Try our Muay Thai class this week!')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ category: 'mismatch', severity: 'error', excerpt: 'Muay Thai' })
    expect(f[0].message).toContain('jiu jitsu')
  })
  it('uses the ad type when one is chosen', () => {
    const f = quickChecks({ texts: [t('Jiu jitsu for kids')], client: { name: 'Atlantic MMA' }, adType: 'muay thai beginners program' })
    expect(f[0].message).toBe('Mentions jiu jitsu, but this is a Muay Thai ad.')
  })
  it("doesn't flag gyms that teach several things", () => {
    expect(quickChecks({ texts: [t('Muay Thai and BJJ')], client: { name: 'Atlantic MMA' } })).toEqual([])
    const f = quickChecks({ texts: [t('Jiu jitsu, plus Muay Thai on Fridays')], client: { name: 'Apex Jiu-Jitsu & MMA' }, adType: 'jiu jitsu kids program' })
    expect(f[0].severity).toBe('warning')
  })
  it('lets jiu jitsu ads mention wrestling, and ignores links', () => {
    expect(run('Jiu jitsu and wrestling for kids')).toEqual([])
    expect(quickChecks({ texts: [t('https://example.com/kickboxing-trial', 'leadform.thankYouUrl')], client: renton })).toEqual([])
    expect(run('Book at https://example.com/kickboxing today')).toEqual([])
  })
})

describe('client details', () => {
  it('flags a phone number that is not theirs', () => {
    const f = run('Call (425) 555-9999 to book')
    expect(f[0]).toMatchObject({ category: 'mismatch', severity: 'warning', excerpt: '(425) 555-9999', suggestion: '(425) 555-1234' })
    expect(run('Call 425-555-1234 to book')).toEqual([])
  })
  it('flags a street number that is not theirs', () => {
    expect(run('Visit us at 120 Main Street')[0].message).toContain("doesn't match")
    expect(run('Visit us at 4300 NE 4th St')).toEqual([])
    expect(run('Call (425) 555-1234 or visit 99 Main St.')[0].excerpt).toBe('99 Main St.')
  })
  it("flags another client's name and city", () => {
    const f = run('Join Gracie Barra Tacoma in Tacoma today', { otherClients: [{ name: 'Gracie Barra Tacoma', city: 'Tacoma' }] })
    expect(f.map((x) => x.severity)).toEqual(['error', 'warning'])
    expect(f[1].message).toBe('Mentions Tacoma, but Gracie Barra Renton is in Renton.')
  })
})

describe('sense checks', () => {
  it('catches a weekday that does not match the date', () => {
    const f = run('Open mat Monday, November 12th')
    expect(f[0]).toMatchObject({ category: 'logic', severity: 'error' })
    expect(f[0].message).toBe('November 12, 2026 is a Thursday, not a Monday.')
    expect(run('Open mat Thursday, November 12th')).toEqual([])
  })
  it('catches impossible dates and leftover placeholders', () => {
    expect(run('Starts Monday February 30')[0].message).toBe("February 30 doesn't exist.")
    expect(run('Claim {{ offer }} today')[0].category).toBe('other')
    // Meta fills in its own URL tags.
    expect(quickChecks({ texts: [t('utm_campaign={{campaign.name}}&utm_content={{ ad.id }}', 'creative.urlParameters')], client: renton })).toEqual([])
  })
})

describe('spelling', () => {
  it('catches common misspellings with a fix', () => {
    const f = run('Our begginers program has a free trail')
    expect(f.map((x) => x.suggestion)).toEqual(['beginners', 'free trial'])
    expect(run('Learn jui jitsu')[0]).toMatchObject({ severity: 'error', suggestion: 'jiu jitsu' })
  })
  it('catches repeated words', () => {
    expect(run('Book the the class')[0]).toMatchObject({ category: 'grammar', suggestion: 'the' })
  })
  it('leaves clean copy alone', () => {
    expect(run('Jiu jitsu for beginners in Renton. Book your free week: (425) 555-1234.')).toEqual([])
  })
})
