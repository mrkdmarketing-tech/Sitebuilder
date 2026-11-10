/**
 * ad-check — the AI mistake check for ad approval (docs/ad-approval.md).
 * Called from the app ("Check for mistakes") by a signed-in employee.
 *
 *  1. Caller must be an active employee who can see the ad (row-level security).
 *  2. Gathers the copy and lead form, the client's details (client_brief), and
 *     the JPEG previews made in the browser at upload: one per image, several
 *     frames per video (on-screen text and burned-in subtitles; no audio).
 *  3. Skips the call if nothing changed since the last successful check.
 *  4. Asks Claude for findings as strict JSON (spelling, grammar, things that
 *     don't make sense, mismatches with the client, CTA), plus a pass / fail /
 *     unsure for the checklist items the AI can judge.
 *  5. Replaces the ad's findings (keeping "Ignore" on issues found again),
 *     pre-fills the checklist's AI column, and records the run and its cost.
 *
 * Secret: ANTHROPIC_API_KEY. Without it, answers "not_configured" and changes nothing.
 * Provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { corsHeaders, json } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/supabase.ts'
import {
  checkableText, findingKey, parseCheckResult, toCreative, toLeadForm,
} from '../../../shared/domain/approvals.ts'

const MODEL = 'claude-opus-5-5'
const PRICE_IN = 4 / 1e6 // $ per input token (Claude Opus 5.5)
const PRICE_OUT = 20 / 1e6 // $ per output token
const MAX_IMAGES = 40
const CATEGORIES = ['spelling', 'grammar', 'logic', 'mismatch', 'cta', 'other']

const SYSTEM = `You check Facebook and Instagram ads for MRKD, a marketing agency for gyms and martial arts academies, before a manager approves them.

Find real mistakes only:
- spelling: misspelled words, wrong or inconsistent business, program or place names
- grammar: broken sentences, wrong words (their/there, it's/its), repeated words, missing words
- logic: things that don't make sense or contradict each other (a "free trial" in one place and a paid trial in another, a day and date that don't match, two different prices or offers, impossible ages or times)
- mismatch: details that don't match the client's information (city, address, phone, gym name, offer, pricing, programs, booking method)
- cta: the call to action in an image doesn't match the headline or primary text, or the button doesn't fit the offer
- other: anything else that would embarrass the agency if it went live (placeholder text like {{ city }}, lorem ipsum, cut-off text)

Do not report:
- style choices that are normal in ads: emojis, ALL CAPS for emphasis, short punchy fragments, missing full stops at the end of lines, informal tone
- Canadian versus American spelling
- the use of Unicode bold or italic letters
- anything you are not reasonably sure is a mistake

Images and video frames: read every word of visible text, including small print and burned-in subtitles. Video frames are stills taken a few seconds apart from the same video; report a subtitle problem once, with the time. Ignore audio entirely.

For each finding give: the field it is in (use the given field names, or "asset" for text inside an image or video), the file number for images and videos (0 when it is in the copy), a short location such as "image 2" or "video 1 at 0:12" (empty when in the copy), the exact text with the problem, a one-sentence explanation, and the corrected text (empty when there is no simple fix). Use severity "error" for definite mistakes, "warning" for likely ones, "info" for minor ones.

For the checklist, answer pass, fail or unsure for each item, only from what you can see. Use unsure when you cannot tell (for example no image was given).

If the ad has no problems, return an empty findings list.`

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, '0')).join('')

const toBase64 = (buf: ArrayBuffer) => {
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const user = userClient(req.headers.get('Authorization'))
  const db = serviceClient()

  // 1. Who is asking, and can they see this ad?
  const { data: me } = await user.rpc('me')
  if (!me?.id) return json({ status: 'error', message: 'Not signed in as an MRKD employee.' }, 403)
  const { reviewId } = await req.json().catch(() => ({}))
  if (!reviewId) return json({ status: 'error', message: 'reviewId is required.' }, 400)
  const { data: review } = await user.from('ad_reviews').select('id, client_id, name, creative, leadform, ad_type, booking_type, legacy_id').eq('id', reviewId).maybeSingle()
  if (!review) return json({ status: 'error', message: 'Ad not found.' }, 404)
  if (review.legacy_id) return json({ status: 'error', message: 'Ads imported from Retool are read-only.' }, 400)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({
      status: 'not_configured',
      message: "The AI check isn't set up yet: an owner needs to add the Claude key (docs/sop/tokens-and-secrets.md). Everything else works.",
    })
  }

  // 2. Gather what to check.
  const creative = toCreative(review.creative)
  const leadform = toLeadForm(review.leadform)
  const texts = checkableText(creative, leadform)
  const [{ data: assets }, { data: brief }, { data: items }, { data: lastRun }] = await Promise.all([
    db.from('ad_review_assets').select('id, kind, file_name, canva_url, duration_sec, frames, position').eq('review_id', reviewId).order('position').order('created_at'),
    db.rpc('client_brief', { p_client: review.client_id }),
    db.from('review_checklist_items').select('key, label').eq('active', true).eq('ai_checkable', true).order('position'),
    db.from('ad_review_check_runs').select('input_hash').eq('review_id', reviewId).eq('status', 'ok').order('started_at', { ascending: false }).limit(1),
  ])
  const files = ((assets ?? []) as { id: string; kind: string; file_name: string | null; canva_url: string | null; duration_sec: number | null; frames: { t: number; path: string }[] }[])
    .filter((a) => (a.frames ?? []).length > 0)
  const checklistKeys = ((items ?? []) as { key: string }[]).map((i) => i.key)

  if (texts.length === 0 && files.length === 0) {
    return json({ status: 'error', message: 'Nothing to check yet: add copy or upload an image or video first.' }, 400)
  }

  // 3. Unchanged since the last good check?
  const facts = brief ? { business: brief.businessName, details: brief.placeholders, onboarding: brief.onboarding, campaign: brief.campaign } : null
  const hash = await sha256(JSON.stringify({ texts, files: files.map((f) => [f.id, f.frames]), facts, adType: review.ad_type, bookingType: review.booking_type, MODEL }))
  if ((lastRun as { input_hash: string }[] | null)?.[0]?.input_hash === hash) {
    return json({ status: 'unchanged', message: 'Nothing changed since the last check.' })
  }

  const { data: run, error: runError } = await db.from('ad_review_check_runs').insert({ review_id: reviewId, status: 'running', model: MODEL, input_hash: hash }).select('id').single()
  if (runError || !run) return json({ status: 'error', message: `Couldn't start the check: ${runError?.message ?? 'unknown error'}` }, 500)
  const fail = async (message: string, status = 502) => {
    await db.from('ad_review_check_runs').update({ status: 'error', error: message, finished_at: new Date().toISOString() }).eq('id', run.id)
    return json({ status: 'error', message }, status)
  }

  try {
    // Images and frames, numbered as the screen numbers them (File 1, 2...).
    const content: Anthropic.Beta.BetaContentBlockParam[] = [{
      type: 'text',
      text: [
        `Ad: ${review.name}`,
        `Ad type: ${review.ad_type ?? 'not set'} · Booking type: ${review.booking_type ?? 'not set'}`,
        '',
        'Client information (the ad must match this):',
        JSON.stringify(facts ?? 'none on file', null, 1),
        '',
        'Ad copy and lead form (field name, label, text):',
        ...texts.map((t) => `[${t.field}] ${t.label}:\n${t.text}`),
        texts.length === 0 ? '(no copy yet)' : '',
      ].join('\n'),
    }]
    let used = 0
    const numberOf = new Map<number, string>()
    for (const [i, f] of files.entries()) {
      if (used >= MAX_IMAGES) break
      const n = i + 1
      numberOf.set(n, f.id)
      content.push({ type: 'text', text: f.kind === 'video'
        ? `File ${n}: video "${f.file_name ?? ''}"${f.duration_sec ? `, ${clock(f.duration_sec)} long` : ''}. Frames follow.`
        : `File ${n}: image "${f.file_name ?? ''}".` })
      for (const fr of f.frames) {
        if (used >= MAX_IMAGES) break
        const { data: blob, error } = await db.storage.from('ad-assets').download(fr.path)
        if (error || !blob) continue
        if (f.kind === 'video') content.push({ type: 'text', text: `Video ${n} at ${clock(fr.t)}:` })
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: toBase64(await blob.arrayBuffer()) } })
        used++
      }
    }
    content.push({
      type: 'text',
      text: `Checklist items to judge: ${JSON.stringify(((items ?? []) as { key: string; label: string }[]).map((i) => ({ key: i.key, item: i.label })))}`,
    })

    // 4. Ask Claude. Strict JSON via structured outputs; server-side fallback if the model declines.
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['findings', 'checklist'],
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['field', 'assetNumber', 'location', 'category', 'severity', 'excerpt', 'message', 'suggestion'],
            properties: {
              field: { type: 'string' },
              assetNumber: { type: 'integer' },
              location: { type: 'string' },
              category: { type: 'string', enum: CATEGORIES },
              severity: { type: 'string', enum: ['error', 'warning', 'info'] },
              excerpt: { type: 'string' },
              message: { type: 'string' },
              suggestion: { type: 'string' },
            },
          },
        },
        checklist: {
          type: 'object',
          additionalProperties: false,
          required: checklistKeys,
          properties: Object.fromEntries(checklistKeys.map((k) => [k, { type: 'string', enum: ['pass', 'fail', 'unsure'] }])),
        },
      },
    }

    const client = new Anthropic({ apiKey })
    let msg: Anthropic.Beta.BetaMessage
    try {
      msg = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
        system: SYSTEM,
        messages: [{ role: 'user', content }],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming)
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return await fail('The Claude key was rejected. An owner needs to check ANTHROPIC_API_KEY.')
      if (err instanceof Anthropic.RateLimitError) return await fail('Claude is busy right now. Try again in a minute.', 429)
      if (err instanceof Anthropic.APIError) return await fail(`Claude returned an error (${err.status}): ${err.message}`)
      throw err
    }

    const cost = (msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0)) * PRICE_IN + msg.usage.output_tokens * PRICE_OUT
    if (msg.stop_reason === 'refusal') return await fail('The AI declined to check this ad. Check it by hand.')
    if (msg.stop_reason === 'max_tokens') return await fail('The AI answer was cut off. Try again, or split the ad.')
    const text = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? ''
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return await fail('The AI answer could not be read. Try again.')
    }
    const result = parseCheckResult(raw, checklistKeys)

    // 5. Save. Issues ignored before stay ignored if found again.
    const { data: previous } = await db.from('ad_review_findings').select('field, excerpt, category, status').eq('review_id', reviewId)
    const ignored = new Set(((previous ?? []) as { field: string | null; excerpt: string | null; category: string; status: string }[])
      .filter((f) => f.status === 'ignored').map(findingKey))
    const rows = result.findings.map((f) => {
      const assetId = f.assetNumber ? numberOf.get(f.assetNumber) ?? null : null
      const field = assetId ? 'asset' : f.field
      const key = findingKey({ field, excerpt: f.excerpt, category: f.category })
      return {
        review_id: reviewId, check_run_id: run.id, asset_id: assetId, field, location: f.location,
        category: f.category, severity: f.severity, excerpt: f.excerpt || null, message: f.message,
        suggestion: f.suggestion, status: ignored.has(key) ? 'ignored' : 'open', finding_key: key,
      }
    })
    await db.from('ad_review_findings').delete().eq('review_id', reviewId)
    if (rows.length) {
      const { error } = await db.from('ad_review_findings').insert(rows)
      if (error) return await fail(`Couldn't save the findings: ${error.message}`, 500)
    }
    if (Object.keys(result.checklist).length) {
      const { data: ticks } = await db.from('ad_review_checklist').select('item_key, checked').eq('review_id', reviewId)
      const checked = new Map(((ticks ?? []) as { item_key: string; checked: boolean }[]).map((t) => [t.item_key, t.checked]))
      await db.from('ad_review_checklist').upsert(
        Object.entries(result.checklist).map(([item_key, ai_result]) => ({ review_id: reviewId, item_key, ai_result, checked: checked.get(item_key) ?? false })),
        { onConflict: 'review_id,item_key' },
      )
    }
    await db.from('ad_review_check_runs').update({
      status: 'ok', cost_usd: Math.round(cost * 10000) / 10000, finished_at: new Date().toISOString(), model: msg.model,
    }).eq('id', run.id)

    const open = rows.filter((r) => r.status === 'open').length
    const skipped = (assets ?? []).length - files.length
    return json({
      status: 'ok',
      message: (open ? `Found ${open} possible issue${open === 1 ? '' : 's'}. Fix them, or mark them Fixed or Ignore.` : 'No mistakes found.')
        + (skipped > 0 ? ` ${skipped} file${skipped === 1 ? " wasn't" : "s weren't"} checked (Canva links and files the browser couldn't read).` : ''),
    })
  } catch (err) {
    return await fail(`The check failed: ${err instanceof Error ? err.message : String(err)}`, 500)
  }
})
