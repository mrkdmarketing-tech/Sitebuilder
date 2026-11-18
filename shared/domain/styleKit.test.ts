import { describe, expect, it } from 'vitest'
import { buildEchoConfig, checkEcho, echoPeopleFor, echoTextFrom, isGracieBarra, railCode, type EchoAd } from './styleKit.ts'

const starter = {
  kicker: 'BEGINNERS', echo: ['FREE', 'TRIAL'] as [string, string], details: ['JIU JITSU &', 'WRESTLING'] as [string, string],
  small: ['NO EXPERIENCE NEEDED', 'UNIFORM INCLUDED'] as [string, string], rail: ['MID CITIES', 'ALL LEVELS', 'D5'] as [string, string, string],
  corner: 'ADULTS', button: 'BOOK YOUR FREE TRIAL',
}
const ad: EchoAd = { person: 'generic-man-40s-dad-shaka-white-gi', palette: 'cream', treat: 'color', flip: false }

describe('Ad Studio: Echo', () => {
  it('fills the client in, keeps the starter copy', () => {
    const t = echoTextFrom(starter, { name: 'Gracie Barra Ottawa', city: 'Ottawa' })
    expect(t).toMatchObject({ brand: 'GRACIE BARRA OTTAWA', railTop: 'OTTAWA', railCode: 'GBO', echo1: 'FREE', echo2: 'TRIAL', button: 'BOOK YOUR FREE TRIAL' })
    expect(railCode('Double Five Mid-Cities')).toBe('DFM')
    expect(isGracieBarra('Gracie Barra Renton')).toBe(true)
    expect(isGracieBarra('Grappletown')).toBe(false)
  })
  it('keeps GB people for GB gyms only', () => {
    const all = ['gb-man-40s-dad-shaka-white-gi', 'generic-man-40s-dad-shaka-white-gi', 'generic-kickboxing-guard']
    expect(echoPeopleFor(all, 'generic')).toEqual(['generic-man-40s-dad-shaka-white-gi', 'generic-kickboxing-guard'])
    expect(echoPeopleFor(all, 'gracie-barra')).toEqual(['gb-man-40s-dad-shaka-white-gi', 'generic-kickboxing-guard'])
  })
  it('builds the kit config', () => {
    const cfg = buildEchoConfig(echoTextFrom(starter, { name: 'Double Five Mid Cities', city: 'Mid Cities' }), 'generic', [ad, { ...ad, flip: true, palette: 'charcoal' }])
    expect(cfg).toMatchObject({ slug: 'double-five-mid-cities', gym_type: 'generic', echo: ['FREE', 'TRIAL'], rail: ['MID CITIES', 'ALL LEVELS', 'DFMC'.slice(0, 3)] })
    expect(cfg.ads.map((a) => a.name)).toEqual(['cream-man-40s-1', 'charcoal-man-40s-left-2'])
  })
  it('applies the house rules', () => {
    const t = echoTextFrom(starter, { name: 'Grappletown', city: null })
    expect(checkEcho(t, 'generic', [ad], { blackFridayOffer: false })).toEqual([])
    expect(checkEcho({ ...t, kicker: 'BLACK FRIDAY' }, 'generic', [ad], { blackFridayOffer: false })[0].severity).toBe('error')
    expect(checkEcho({ ...t, kicker: 'BLACK FRIDAY' }, 'generic', [ad], { blackFridayOffer: true })).toEqual([])
    expect(checkEcho(t, 'generic', [{ ...ad, person: 'gb-man-40s-dad-shaka-white-gi' }], { blackFridayOffer: false })[0].message).toContain('Gracie Barra')
    expect(checkEcho({ ...t, echo1: 'SAVE', echo2: '$300' }, 'generic', [ad], { blackFridayOffer: false })[0]).toMatchObject({ severity: 'warning' })
    expect(checkEcho({ ...t, kicker: '' }, 'generic', [], { blackFridayOffer: false }).map((p) => p.field)).toEqual(['kicker', 'ads'])
  })
})
