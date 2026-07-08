import { getSupabase } from '../lib/supabase'
import { env } from '../lib/env'
import { fireFromRow, fireUpdateFromRow, type Fire, type FireUpdate } from '../domain'
import { SAMPLE_FIRES, SAMPLE_UPDATES } from './fixtures'

// With no Supabase project configured the app runs on fixtures so the UI is
// fully explorable offline; with env set it reads the real tables.
export const isDemo = env.supabaseUrl.length === 0

export async function fetchFires(): Promise<Fire[]> {
  if (isDemo) return SAMPLE_FIRES
  const { data, error } = await getSupabase()
    .from('fires')
    .select('*')
    .order('discovered_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(fireFromRow)
}

export async function fetchFireUpdates(fireId: string): Promise<FireUpdate[]> {
  if (isDemo) return SAMPLE_UPDATES[fireId] ?? []
  const { data, error } = await getSupabase()
    .from('fire_updates')
    .select('*')
    .eq('fire_id', fireId)
    .order('posted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(fireUpdateFromRow)
}
