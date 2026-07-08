import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { env } from './env'

// A single typed client. `Database` gives `.from('fires')` fully-typed rows, so
// a column rename surfaces as a compile error instead of a runtime surprise.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
