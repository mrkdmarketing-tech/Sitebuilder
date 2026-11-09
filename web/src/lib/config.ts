/**
 * Runtime configuration. If the Supabase URL/key aren't set, the app runs in
 * SAMPLE DATA mode: no login, fictional numbers generated in the browser.
 * See web/.env.example and docs/development.md.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const SAMPLE_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY
