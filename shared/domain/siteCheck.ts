/**
 * What a client's website is built on, and a few basic SEO signals, from its
 * home page HTML (docs/seo.md). Used by the site-check function. Read-only.
 */
export type Platform =
  | 'wordpress' | 'wix' | 'squarespace' | 'ghl' | 'webflow' | 'godaddy' | 'duda' | 'shopify'
  | 'weebly' | 'framer' | 'kicksite' | 'gymdesk' | 'graciebarra' | 'other'

const MARKERS: [Platform, RegExp][] = [
  ['graciebarra', /graciebarra\.com/i],
  ['wordpress', /wp-content|wp-includes|wp-json|<meta[^>]+generator[^>]+wordpress/i],
  ['wix', /static\.wixstatic\.com|wix-bolt|x-wix|_wixCssImports|wixsite/i],
  ['squarespace', /static1\.squarespace\.com|squarespace-cdn|<!-- this is squarespace/i],
  ['ghl', /msgsndr\.com|leadconnectorhq|assets\.cdn\.filesafe\.space|highlevel|gohighlevel/i],
  ['webflow', /webflow\.(com|io)|data-wf-page/i],
  ['godaddy', /img1\.wsimg\.com|godaddy/i],
  ['duda', /dudaone|irp\.cdn-website\.com|dmalbum/i],
  ['shopify', /cdn\.shopify\.com/i],
  ['weebly', /weebly/i],
  ['framer', /framerusercontent|framer\.com\/m\//i],
  ['kicksite', /kicksite/i],
  ['gymdesk', /gymdesk/i],
]

/** Turn whatever was typed into GHL into a URL we can open, or null. */
export function cleanSiteUrl(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim()
  if (!s) return null
  // Facebook outbound links: l.facebook.com/l.php?u=<real url>
  const fb = s.match(/[?&]u=([^&]+)/)
  if (/facebook\.com\/l\.php/i.test(s) && fb) s = decodeURIComponent(fb[1])
  if (s.includes('@') && !s.includes('/')) return null
  if (/^https?:\/\/[^/]*@/i.test(s)) return null // e.g. http://www.name@gmail.com
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    u.search = ''
    u.hash = ''
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`
  } catch {
    return null
  }
}

export interface SiteSignals {
  platform: Platform
  title: string | null
  description: string | null
  h1: number
  localBusinessSchema: boolean
  anySchema: boolean
  viewport: boolean
  canonical: boolean
}

export function readSite(html: string, finalUrl: string, headers: Record<string, string> = {}): SiteSignals {
  const all = `${finalUrl}\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n${html}`
  const platform = MARKERS.find(([, re]) => re.test(all))?.[0] ?? 'other'
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i'))?.[1]
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
  return {
    platform,
    title,
    description: meta('description')?.trim() || null,
    h1: (html.match(/<h1[\s>]/gi) ?? []).length,
    localBusinessSchema: jsonLd.some((j) => /LocalBusiness|SportsActivityLocation|ExerciseGym|SportsClub|HealthClub|MartialArts/i.test(j)),
    anySchema: jsonLd.length > 0,
    viewport: /<meta[^>]+name=["']viewport/i.test(html),
    canonical: /<link[^>]+rel=["']canonical/i.test(html),
  }
}
