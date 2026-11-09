// Service-role Supabase client for background jobs. The service role bypasses
// row-level security, so it must NEVER be used in the browser.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// Edge Functions by Supabase.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Client acting as the signed-in user (RLS applies). For user-triggered functions. */
export function userClient(authHeader: string | null): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  return createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  })
}
