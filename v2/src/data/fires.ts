import { getSupabase } from '../lib/supabase'
import { env } from '../lib/env'
import { fireFromRow, fireUpdateFromRow, hotspotFromRow, type Fire, type FireUpdate, type Hotspot } from '../domain'
import { SAMPLE_FIRES, SAMPLE_UPDATES } from './fixtures'
import { SAMPLE_HOTSPOTS } from './hotspotFixtures'
import { fetchLiveFires } from './live'

export type DataMode = 'supabase' | 'live' | 'demo'

// How the app sources data:
//  - supabase: read the project's tables (set VITE_SUPABASE_URL). Adds history,
//    hotspots, AQI, realtime.
//  - live: no backend — fetch NIFC WFIGS directly in the browser (the default).
//  - demo: bundled fixtures (VITE_DATA_MODE=demo), for offline development.
export const dataMode: DataMode =
  env.supabaseUrl.length > 0
    ? 'supabase'
    : import.meta.env.VITE_DATA_MODE === 'demo'
      ? 'demo'
      : 'live'

export async function fetchFires(): Promise<Fire[]> {
  if (dataMode === 'demo') return SAMPLE_FIRES
  if (dataMode === 'live') return fetchLiveFires()
  const { data, error } = await getSupabase()
    .from('fires')
    .select('*')
    .order('discovered_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(fireFromRow)
}

export async function fetchHotspots(): Promise<Hotspot[]> {
  if (dataMode === 'demo') return SAMPLE_HOTSPOTS
  if (dataMode === 'live') return [] // FIRMS needs an API key + a server to hold it
  const { data, error } = await getSupabase()
    .from('hotspots')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  return (data ?? []).map(hotspotFromRow)
}

export async function fetchFireUpdates(fireId: string): Promise<FireUpdate[]> {
  if (dataMode === 'demo') return SAMPLE_UPDATES[fireId] ?? []
  if (dataMode === 'live') return [] // update history requires a backend to diff snapshots over time
  const { data, error } = await getSupabase()
    .from('fire_updates')
    .select('*')
    .eq('fire_id', fireId)
    .order('posted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(fireUpdateFromRow)
}
