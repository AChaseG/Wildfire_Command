import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { env } from './env'

// Lazily constructed so the app still runs in demo mode (no env), where the
// client is never touched. `Database` gives `.from('fires')` fully-typed rows,
// so a column rename becomes a compile error instead of a runtime surprise.
let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    if (!env.supabaseUrl) {
      throw new Error('Supabase is not configured (VITE_SUPABASE_URL is missing).')
    }
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
  }
  return client
}
