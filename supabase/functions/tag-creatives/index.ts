/**
 * tag-creatives: reads each ad creative's copy with TypeSafe's Jev model and
 * saves what it offers, who it speaks to and how it opens (docs/creative-tags.md).
 * Questions and answer parsing: shared/domain/creativeTags.ts.
 *
 * Scheduled hourly at :50 with the cron secret (migration 2800). Each run tags up
 * to 400 creatives that have no tags yet, biggest recent spenders first; once the
 * backlog is done, runs only find the few new ads. ?limit=<n> for a one-off run.
 *
 * Secret: TYPESAFE_API_KEY (Supabase Edge Function secrets). Without it the run
 * does nothing and says so on the Sync screen.
 */
import { createHash } from 'node:crypto'
import { creativeText, jevRequest, parseJevAnswer } from '../../../shared/domain/creativeTags.ts'
import { isAuthorisedCron, json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { logRun } from '../_shared/sync-log.ts'

const API = 'https://api.typesafe.ai/v1/systemone'
const MODEL = Deno.env.get('JEV_MODEL') ?? 'jev-latest'
const PARALLEL = 6

class StopRun extends Error {}

async function askJev(key: string, state: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(jevRequest(state, MODEL)),
    })
    if (res.ok) return res.json()
    const text = (await res.text()).slice(0, 300)
    if (res.status === 401 || res.status === 403) throw new StopRun(`TypeSafe refused the key (${res.status}): ${text}`)
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }
    throw new Error(`TypeSafe ${res.status}: ${text}`)
  }
}

Deno.serve(async (req) => {
  if (!isAuthorisedCron(req)) return json({ error: 'unauthorised' }, 401)
  const key = Deno.env.get('TYPESAFE_API_KEY')
  const db = serviceClient()
  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || 400, 2000)
  try {
    const result = await logRun(db, 'creatives.tag', async () => {
      if (!key) return { rows: 0, details: { skipped: 'TYPESAFE_API_KEY is not set.' } }
      const { data, error } = await db.rpc('creatives_to_tag', { p_limit: limit })
      if (error) throw new Error(error.message)
      const todo = (data ?? []) as { id: string; title: string | null; body: string | null }[]

      let tagged = 0, unreadable = 0, failed = 0
      let firstProblem: string | null = null
      let sample: unknown = null
      const queue = [...todo]
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          const state = creativeText(c)
          if (!state) continue
          try {
            const raw = await askJev(key, state)
            const tags = parseJevAnswer(raw)
            if (!tags.offer && !tags.audience && !tags.hook) {
              // Never save an empty guess; keep one example to see what came back.
              unreadable++
              sample ??= raw
              continue
            }
            const { error: e } = await db.from('creative_tags').upsert({
              creative_id: c.id, offer: tags.offer, audience: tags.audience, hook: tags.hook,
              confidence: tags.confidence, model: MODEL,
              input_hash: createHash('sha256').update(state).digest('hex'), tagged_at: new Date().toISOString(),
            })
            if (e) throw new Error(e.message)
            tagged++
          } catch (err) {
            if (err instanceof StopRun) throw err
            failed++
            firstProblem ??= (err as Error).message
          }
        }
      }
      await Promise.all(Array.from({ length: PARALLEL }, worker))
      if (todo.length && !tagged && (unreadable || failed)) {
        throw new Error(firstProblem ?? `Couldn't read Jev's answers. Example: ${JSON.stringify(sample).slice(0, 400)}`)
      }
      return {
        rows: tagged, partial: unreadable + failed > 0,
        details: { found: todo.length, tagged, unreadable, failed, firstProblem, sample: sample ? JSON.stringify(sample).slice(0, 400) : null },
      }
    })
    return json(result)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
