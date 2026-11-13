/**
 * site-check: opens each active client's home page (like a visitor would) and
 * records what it's built on plus basic SEO signals (docs/seo.md). Read-only:
 * nothing is changed on any site. Called with the cron secret.
 */
import { cleanSiteUrl, readSite } from '../../../shared/domain/siteCheck.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const db = serviceClient()
  const { data: clients, error } = await db.from('clients').select('id, business_name, website').in('active_status', ['Active', 'New'])
  if (error) return json({ error: error.message }, 500)

  const results: Record<string, unknown>[] = []
  const queue = [...(clients ?? [])]
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const url = cleanSiteUrl(c.website as string | null)
      if (!url) { results.push({ id: c.id, client: c.business_name, url: null, problem: 'No usable website on file' }); continue }
      try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MRKD-Lab-SiteCheck/1.0)' } })
        const html = (await res.text()).slice(0, 600_000)
        const headers: Record<string, string> = {}
        res.headers.forEach((v, k) => { headers[k] = v })
        results.push({ id: c.id, client: c.business_name, url, finalUrl: res.url, status: res.status, server: headers['server'] ?? null, ...readSite(html, res.url, headers) })
      } catch (err) {
        results.push({ id: c.id, client: c.business_name, url, problem: `Couldn't open: ${(err as Error).message.slice(0, 120)}` })
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return json({ checked: results.length, results })
})
