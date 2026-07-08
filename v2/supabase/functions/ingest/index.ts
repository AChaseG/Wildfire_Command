import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { Connector, FireUpsert } from '../_shared/connectors/types.ts'
import { wfigsConnector } from '../_shared/connectors/wfigs.ts'

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
  status: 'ok' | 'error'
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
  const ok = results.every((r) => r.status === 'ok')
  return json({ ok, results }, 200)
})

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
