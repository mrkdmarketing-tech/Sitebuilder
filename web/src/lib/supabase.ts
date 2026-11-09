import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SAMPLE_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

/** Browser Supabase client (anon key + the user's session; RLS applies). Null in sample mode. */
export const supabase: SupabaseClient | null = SAMPLE_MODE
  ? null
  : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
