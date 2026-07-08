import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Connector, FireUpsert, HotspotUpsert } from '../_shared/connectors/types.ts'
import { wfigsConnector } from '../_shared/connectors/wfigs.ts'
import { fetchFirmsHotspots } from '../_shared/connectors/firms.ts'
import { nearestAqi, pm25ToAqi, windFromMeteo, type Sensor } from '../_shared/enrich.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

// The registry of connectors the orchestrator runs. Adding a source (FIRMS,
// PurpleAir, wind) is a one-line change here plus a new module in _shared.
const CONNECTORS: readonly Connector[] = [wfigsConnector]

interface ConnectorResult {
  connector: string
  status: 'ok' | 'error' | 'skipped'
  fetched: number
  upserted: number
  logged: number
  error: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const results: ConnectorResult[] = []
  for (const connector of CONNECTORS) {
    results.push(await runConnector(db, connector))
  }
  results.push(await runHotspots(db))
  results.push(await enrichActiveFires(db))
  const ok = results.every((r) => r.status !== 'error')
  return json({ ok, results }, 200)
})

// FIRMS satellite hotspots -> hotspots table. Skipped without a MAP_KEY.
async function runHotspots(db: SupabaseClient): Promise<ConnectorResult> {
  const mapKey = Deno.env.get('FIRMS_MAP_KEY')
  if (!mapKey) return { connector: 'firms', status: 'skipped', fetched: 0, upserted: 0, logged: 0, error: null }
  try {
    const rows: HotspotUpsert[] = await fetchFirmsHotspots(mapKey)
    if (rows.length > 0) {
      const { error } = await db.from('hotspots').upsert(rows, { onConflict: 'latitude,longitude,detected_at,satellite' })
      if (error) throw new Error(error.message)
    }
    return { connector: 'firms', status: 'ok', fetched: rows.length, upserted: rows.length, logged: 0, error: null }
  } catch (err) {
    return { connector: 'firms', status: 'error', fetched: 0, upserted: 0, logged: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

// Fills wind (Open-Meteo, keyless) and AQI (PurpleAir, if keyed) on active fires.
async function enrichActiveFires(db: SupabaseClient): Promise<ConnectorResult> {
  try {
    const { data: active } = await db
      .from('fires')
      .select('id, latitude, longitude')
      .eq('status', 'active')
    const fires = (active ?? []) as Array<{ id: string; latitude: number; longitude: number }>
    if (fires.length === 0) return { connector: 'enrich', status: 'ok', fetched: 0, upserted: 0, logged: 0, error: null }

    const winds = await fetchWind(fires)
    const sensors = await fetchPurpleAirSensors()

    let updated = 0
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i]!
      const patch: Record<string, unknown> = {}
      const w = winds[i]
      if (w) {
        patch.wind_speed_mph = w.windSpeedMph
        patch.wind_direction_deg = w.windDirectionDeg
      }
      if (sensors.length > 0) {
        const aqi = nearestAqi({ lat: f.latitude, lng: f.longitude }, sensors)
        if (aqi != null) patch.aqi = aqi
      }
      if (Object.keys(patch).length === 0) continue
      const { error } = await db.from('fires').update(patch).eq('id', f.id)
      if (!error) updated++
    }
    return { connector: 'enrich', status: 'ok', fetched: fires.length, upserted: updated, logged: 0, error: null }
  } catch (err) {
    return { connector: 'enrich', status: 'error', fetched: 0, upserted: 0, logged: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

async function fetchWind(
  fires: Array<{ latitude: number; longitude: number }>,
): Promise<Array<{ windSpeedMph: number | null; windDirectionDeg: number | null } | null>> {
  const lats = fires.map((f) => f.latitude.toFixed(4)).join(',')
  const lngs = fires.map((f) => f.longitude.toFixed(4)).join(',')
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return fires.map(() => null)
    const data = await res.json()
    const arr = Array.isArray(data) ? data : [data]
    return fires.map((_, i) => windFromMeteo(arr[i]?.current))
  } catch {
    return fires.map(() => null)
  }
}

// Continental-US PurpleAir sensors -> {lat,lng,aqi}. Empty without a key.
async function fetchPurpleAirSensors(): Promise<Sensor[]> {
  const key = Deno.env.get('PURPLEAIR_API_KEY')
  if (!key) return []
  try {
    const url = 'https://api.purpleair.com/v1/sensors?fields=latitude,longitude,pm2.5&nwlng=-125&nwlat=49&selng=-66&selat=24'
    const res = await fetch(url, { headers: { 'X-API-Key': key } })
    if (!res.ok) return []
    const data = await res.json() as { fields?: string[]; data?: unknown[][] }
    const fields = data.fields ?? []
    const iLat = fields.indexOf('latitude')
    const iLng = fields.indexOf('longitude')
    const iPm = fields.indexOf('pm2.5')
    if (iLat === -1 || iLng === -1 || iPm === -1) return []
    const sensors: Sensor[] = []
    for (const row of data.data ?? []) {
      const lat = Number(row[iLat])
      const lng = Number(row[iLng])
      const pm = Number(row[iPm])
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(pm)) {
        sensors.push({ lat, lng, aqi: pm25ToAqi(pm) })
      }
    }
    return sensors
  } catch {
    return []
  }
}

async function runConnector(db: SupabaseClient, connector: Connector): Promise<ConnectorResult> {
  const started = new Date().toISOString()
  const { data: run } = await db
    .from('ingest_runs')
    .insert({ connector: connector.name, started_at: started, status: 'running' })
    .select('id')
    .single()
  const runId = run?.id as string | undefined

  try {
    const rows = await connector.fetch()
    const { upserted, logged } = await persist(db, rows)
    await finishRun(db, runId, 'ok', rows.length, upserted, null)
    return { connector: connector.name, status: 'ok', fetched: rows.length, upserted, logged, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finishRun(db, runId, 'error', 0, 0, message.slice(0, 500))
    return { connector: connector.name, status: 'error', fetched: 0, upserted: 0, logged: 0, error: message }
  }
}

async function finishRun(
  db: SupabaseClient,
  runId: string | undefined,
  status: 'ok' | 'error',
  fetched: number,
  upserted: number,
  error: string | null,
): Promise<void> {
  if (!runId) return
  await db
    .from('ingest_runs')
    .update({ finished_at: new Date().toISOString(), status, fetched, upserted, error })
    .eq('id', runId)
}

interface PriorFire {
  id: string
  external_id: string
  acres: number
  containment_pct: number
  severity: string
  status: string
}

// Upserts the connector rows and logs a fire_updates entry for each meaningful
// change (new incident, acreage, containment, status, severity).
async function persist(db: SupabaseClient, rows: FireUpsert[]): Promise<{ upserted: number; logged: number }> {
  if (rows.length === 0) return { upserted: 0, logged: 0 }

  const externalIds = rows.map((r) => r.external_id)
  const { data: existing } = await db
    .from('fires')
    .select('id, external_id, acres, containment_pct, severity, status')
    .in('external_id', externalIds)
  const prior = new Map<string, PriorFire>((existing ?? []).map((f: PriorFire) => [f.external_id, f]))

  const { data: saved, error } = await db
    .from('fires')
    .upsert(rows, { onConflict: 'source,external_id' })
    .select('id, external_id')
  if (error) throw new Error(error.message)
  const idByExternal = new Map<string, string>((saved ?? []).map((f: { id: string; external_id: string }) => [f.external_id, f.id]))

  const now = new Date().toISOString()
  const updates: Array<{ fire_id: string; posted_at: string; kind: string; title: string; body: string }> = []

  for (const row of rows) {
    const fireId = idByExternal.get(row.external_id)
    if (!fireId) continue
    const before = prior.get(row.external_id)

    if (!before) {
      updates.push({
        fire_id: fireId, posted_at: row.discovered_at, kind: 'general',
        title: 'Incident reported',
        body: `New wildfire reported${row.location_description ? ` near ${row.location_description}` : ''} at ${row.acres.toLocaleString()} acres, ${row.containment_pct}% contained.`,
      })
      continue
    }

    if (row.containment_pct !== before.containment_pct) {
      const dir = row.containment_pct > before.containment_pct ? 'increased' : 'decreased'
      updates.push({
        fire_id: fireId, posted_at: now, kind: 'containment',
        title: `Containment ${dir} to ${row.containment_pct}%`,
        body: `Containment ${dir} from ${before.containment_pct}% to ${row.containment_pct}%.`,
      })
    }
    if (row.acres !== before.acres) {
      const dir = row.acres > before.acres ? 'grew to' : 'revised to'
      updates.push({
        fire_id: fireId, posted_at: now, kind: 'general',
        title: `Fire ${dir} ${row.acres.toLocaleString()} acres`,
        body: `Burned area changed from ${before.acres.toLocaleString()} to ${row.acres.toLocaleString()} acres.`,
      })
    }
    if (row.status !== before.status) {
      updates.push({
        fire_id: fireId, posted_at: now, kind: 'containment',
        title: `Status changed to ${cap(row.status)}`,
        body: `Incident status updated from ${before.status} to ${row.status}.`,
      })
    }
    if (row.severity !== before.severity) {
      updates.push({
        fire_id: fireId, posted_at: now, kind: 'general',
        title: `Severity reclassified to ${cap(row.severity)}`,
        body: `Incident severity changed from ${before.severity} to ${row.severity}.`,
      })
    }
  }

  let logged = 0
  if (updates.length > 0) {
    const { count } = await db.from('fire_updates').insert(updates, { count: 'exact' })
    logged = count ?? updates.length
  }

  return { upserted: saved?.length ?? 0, logged }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
