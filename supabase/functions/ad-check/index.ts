/**
 * ad-check — the AI quality check for ad approval (Phase 2, plan.md M6,
 * docs/ad-approval.md).
 *
 * STATUS: skeleton. Flow:
 *   1. Load the ad review (copy, lead form) + client details (onboarding,
 *      campaign specifics, city, phone, offer) for "does it match the client?".
 *   2. Images: send to Claude (vision) → read all text, check spelling, grammar,
 *      logic, CTA vs headline/primary text, logo, address/phone.
 *   3. Videos: the browser extracts frames at upload (no video server); send
 *      frames to Claude to read on-screen text and burned-in subtitles.
 *      No audio check (agreed Nov 2026).
 *   4. Copy: spelling, grammar, things that don't make sense, mismatches.
 *   5. Store a check run + findings (field, location, category, message, fix).
 *   6. Pre-fill AI-checkable checklist items (review_checklist_items.ai_checkable).
 * Secret: ANTHROPIC_API_KEY.
 */
import { corsHeaders, json } from '../_shared/http.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  return json({ error: 'not implemented yet (phase 2)' }, 501)
})
