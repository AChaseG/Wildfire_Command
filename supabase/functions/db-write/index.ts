import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

// Validated write gateway for the public (no-auth) client. Direct anonymous
// writes to these tables are blocked by RLS; every mutation must pass through
// here, where it is constrained to a known table, operation, column set, and a
// mandatory row filter (so no unfiltered table-wide update/delete is possible).
type OpRule = { cols?: string[]; match?: boolean }
type TableRule = { insert?: OpRule; update?: OpRule; delete?: OpRule }

const RULES: Record<string, TableRule> = {
  key_locations: {
    insert: { cols: ["name", "description", "latitude", "longitude", "color", "is_favorite", "visible"] },
    update: { cols: ["name", "description", "latitude", "longitude", "color", "is_favorite", "visible"], match: true },
    delete: { match: true },
  },
  alert_rules: {
    insert: { cols: ["name", "enabled", "severity_min", "aqi_min", "containment_max", "status", "keyword", "alert_severity", "category", "geo_type", "geo_polygon", "geo_center_lat", "geo_center_lng", "geo_radius_m"] },
    update: { cols: ["name", "enabled", "severity_min", "aqi_min", "containment_max", "status", "keyword", "alert_severity", "category", "geo_type", "geo_polygon", "geo_center_lat", "geo_center_lng", "geo_radius_m"], match: true },
    delete: { match: true },
  },
  alerts: {
    insert: { cols: ["rule_id", "fire_id", "severity", "category", "headline", "summary", "source", "latitude", "longitude", "acknowledged", "acknowledged_at", "generated_at", "source_type", "rule_name", "social_platform", "content_url"] },
    update: { cols: ["acknowledged", "acknowledged_at"], match: true },
    delete: { match: true },
  },
  data_sources: {
    insert: { cols: ["name", "url", "category", "description", "enabled", "is_default"] },
    update: { cols: ["name", "url", "category", "description", "enabled", "is_default"], match: true },
    delete: { match: true },
  },
  notification_settings: {
    update: { cols: ["slack_webhook_url", "enabled", "updated_at"], match: true },
  },
  wildfires: {
    update: { cols: ["monitored"], match: true },
  },
}

const MATCH_COLUMNS = new Set(["id"])

function pick(obj: Record<string, unknown>, cols: string[]) {
  const out: Record<string, unknown> = {}
  for (const c of cols) {
    if (Object.prototype.hasOwnProperty.call(obj, c)) out[c] = obj[c]
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body" }, 400)
    }

    const { table, op, values, patch, match, returning } = body as Record<string, any>
    const tableRule = RULES[table]
    if (!tableRule) return json({ error: `Table not allowed: ${table}` }, 403)
    const opRule = tableRule[op as keyof TableRule]
    if (!opRule) return json({ error: `Operation '${op}' not allowed on ${table}` }, 403)

    // Validate the row filter for update/delete.
    let filter: { column: string; value?: unknown; in?: unknown[] } | null = null
    if (opRule.match) {
      if (!match || typeof match !== "object" || !MATCH_COLUMNS.has(match.column)) {
        return json({ error: "A valid match filter is required" }, 400)
      }
      const hasValue = Object.prototype.hasOwnProperty.call(match, "value")
      const hasIn = Array.isArray(match.in) && match.in.length > 0
      if (!hasValue && !hasIn) {
        return json({ error: "Match must specify a value or a non-empty 'in' list" }, 400)
      }
      filter = { column: match.column, value: match.value, in: match.in }
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    let query
    if (op === "insert") {
      const cols = opRule.cols || []
      const rows = Array.isArray(values) ? values : [values]
      const clean = rows
        .filter((r) => r && typeof r === "object")
        .map((r) => pick(r, cols))
      if (clean.length === 0) return json({ error: "No valid rows to insert" }, 400)
      query = db.from(table).insert(clean)
    } else if (op === "update") {
      const cols = opRule.cols || []
      const clean = pick(patch || {}, cols)
      if (Object.keys(clean).length === 0) return json({ error: "No valid columns to update" }, 400)
      query = db.from(table).update(clean)
      query = filter!.in ? query.in(filter!.column, filter!.in) : query.eq(filter!.column, filter!.value)
    } else if (op === "delete") {
      query = db.from(table).delete()
      query = filter!.in ? query.in(filter!.column, filter!.in) : query.eq(filter!.column, filter!.value)
    } else {
      return json({ error: `Unknown operation: ${op}` }, 400)
    }

    if (returning === "single") query = query.select().single()
    else if (returning === "maybeSingle") query = query.select().maybeSingle()
    else if (returning === "many") query = query.select()

    const { data, error } = await query
    if (error) return json({ error: error.message }, 400)

    return json({ data: data ?? null }, 200)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
