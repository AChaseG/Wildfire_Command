import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

const COLS = 9
const ROWS = 6

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}

// Composite fire-weather danger from live conditions. Hotter, drier, windier
// air plus low fuel (soil) moisture => higher risk of ignition and spread.
function computeRisk(t: number, rh: number, wind: number, precip: number, soil: number | null) {
  const tempScore = clamp((t - 5) / 35)
  const humScore = clamp((100 - rh) / 100)
  const windScore = clamp(wind / 50)
  const dryScore = clamp(1 - precip / 8)
  const moistScore = soil != null ? clamp(1 - soil / 0.4) : dryScore
  return clamp(0.28 * tempScore + 0.27 * humScore + 0.2 * windScore + 0.12 * dryScore + 0.13 * moistScore)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    let { minLat, minLng, maxLat, maxLng } = body as Record<string, number>

    if (
      [minLat, minLng, maxLat, maxLng].some((v) => typeof v !== "number" || Number.isNaN(v))
    ) {
      // Sensible default: continental view
      minLat = 24; maxLat = 50; minLng = -125; maxLng = -66
    }

    // Clamp to valid ranges and guard against inverted / world-spanning boxes
    minLat = clamp(minLat, -85, 85); maxLat = clamp(maxLat, -85, 85)
    minLng = clamp(minLng, -180, 180); maxLng = clamp(maxLng, -180, 180)
    if (maxLat <= minLat) maxLat = minLat + 1
    if (maxLng <= minLng) maxLng = minLng + 1

    // Even sample grid across the viewport, snapped to 0.25deg for cache reuse.
    const lats: number[] = []
    const lngs: number[] = []
    const keys: string[] = []
    const snap = (n: number) => Math.round(n * 4) / 4
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const lat = snap(minLat + ((maxLat - minLat) * (r + 0.5)) / ROWS)
        const lng = snap(minLng + ((maxLng - minLng) * (c + 0.5)) / COLS)
        lats.push(lat)
        lngs.push(lng)
        keys.push(`${lat.toFixed(2)}_${lng.toFixed(2)}`)
      }
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}` +
      `&longitude=${lngs.join(",")}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,soil_moisture_0_to_1cm` +
      `&timezone=UTC`

    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error(`Open-Meteo request failed (${resp.status})`)
    }
    const data = await resp.json()
    // Multi-location responses come back as an array; single as an object.
    const points = Array.isArray(data) ? data : [data]

    const rows = points.map((pt: any, i: number) => {
      const cur = pt.current || {}
      const t = Number(cur.temperature_2m ?? 15)
      const rh = Number(cur.relative_humidity_2m ?? 50)
      const wind = Number(cur.wind_speed_10m ?? 5)
      const precip = Number(cur.precipitation ?? 0)
      const soilRaw = cur.soil_moisture_0_to_1cm
      const soil = soilRaw == null ? null : Number(soilRaw)
      return {
        grid_key: keys[i],
        latitude: lats[i],
        longitude: lngs[i],
        risk: computeRisk(t, rh, wind, precip, soil),
        temperature: t,
        humidity: rh,
        wind_speed: wind,
        precipitation: precip,
        soil_moisture: soil,
        computed_at: new Date().toISOString(),
      }
    })

    // Deduplicate by grid_key (snapping can collide) before upsert.
    const byKey = new Map<string, typeof rows[number]>()
    for (const row of rows) byKey.set(row.grid_key, row)
    const unique = [...byKey.values()]

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const { error } = await db
      .from("fire_risk_cells")
      .upsert(unique, { onConflict: "grid_key" })
    if (error) throw error

    return new Response(JSON.stringify({ cells: unique }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
