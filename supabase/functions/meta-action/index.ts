/**
 * meta-action — performs a suggestion's "Do it" action in Meta (Phase 1b).
 * Called from the app by a signed-in staff member, e.g. "Turn off" an ad.
 *
 * STATUS: skeleton. Safety steps, in order:
 *   1. Verify the caller is an active employee (RLS via their JWT).
 *   2. Load the suggestion; it must be 'open'.
 *   3. Re-read the ad from Meta; if it's already paused, mark done and stop.
 *   4. POST /{ad_id} status=PAUSED with the System User token.
 *   5. Write actions_log (who, before/after, result) and mark suggestion 'done'.
 */
import { corsHeaders, json } from '../_shared/http.ts'
import { userClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const user = userClient(req.headers.get('Authorization'))
  const { data: isStaff } = await user.rpc('is_staff')
  if (!isStaff) return json({ error: 'not allowed' }, 403)
  const { suggestionId } = await req.json().catch(() => ({}))
  if (!suggestionId) return json({ error: 'suggestionId required' }, 400)
  // TODO(phase 1b): steps 2–5.
  return json({ error: 'not implemented yet' }, 501)
})
