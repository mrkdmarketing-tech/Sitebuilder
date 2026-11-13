import { describe, expect, it } from 'vitest'
import { cleanSiteUrl, readSite } from './siteCheck.ts'

describe('site check', () => {
  it('cleans the URLs typed into GHL', () => {
    expect(cleanSiteUrl('aonjiujitsu.com')).toBe('https://aonjiujitsu.com/')
    expect(cleanSiteUrl('https://l.facebook.com/l.php?u=http%3A%2F%2Faacemartialartsacademy.com%2F%3Ffbclid%3Dx&h=y')).toBe('http://aacemartialartsacademy.com/')
    expect(cleanSiteUrl('http://www.doublefivemidcities@gmail.com')).toBeNull()
    expect(cleanSiteUrl('https://Www.aegisjj.com')).toBe('https://www.aegisjj.com/')
    expect(cleanSiteUrl(null)).toBeNull()
  })
  it('spots the platform and basic signals', () => {
    const html = `<html><head><title> GB Renton </title><meta name="description" content="Jiu jitsu in Renton">
      <meta name="viewport" content="w"><link rel="stylesheet" href="/wp-content/x.css">
      <script type="application/ld+json">{"@type":"SportsActivityLocation"}</script></head><body><h1>Hi</h1></body></html>`
    expect(readSite(html, 'https://x.com/')).toMatchObject({ platform: 'wordpress', title: 'GB Renton', description: 'Jiu jitsu in Renton', h1: 1, localBusinessSchema: true, viewport: true })
    expect(readSite('<img src="https://static.wixstatic.com/a.png">', 'https://y.com/').platform).toBe('wix')
    expect(readSite('<script src="https://assets.cdn.filesafe.space/x.js"></script>', 'https://z.com/').platform).toBe('ghl')
  })
})
