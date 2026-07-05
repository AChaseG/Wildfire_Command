import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

// NASA FIRMS active-fire detections (VIIRS S-NPP, near real-time).
// The FIRMS "area" API needs a free MAP_KEY:
//   https://firms.modaps.eosdis.nasa.gov/api/map_key/
// Bounding box (west,south,east,north) focused on the western US / PNW where
// this deployment's curated sources are centered.
const FIRMS_SOURCE = "VIIRS_SNPP_NRT"
const FIRMS_AREA = "-130,30,-100,52"
const DAY_RANGE = 1
const MAX_DETECTIONS = 25
// NASA FIRMS enforces a rolling transaction quota; keep our own usage capped
// well under it. Each area/status request counts as one transaction.
const TRANSACTION_CAP = 5000

async function transactionCount(mapKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${mapKey}`,
      { headers: { "User-Agent": "WildfireCommand/1.0" } },
    )
    if (!res.ok) return null
    const status = await res.json()
    const current = Number(status?.current_transactions)
    return Number.isFinite(current) ? current : null
  } catch {
    return null
  }
}

function csvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(",")
  return lines.slice(1).map((line) => {
    const cells = line.split(",")
    const row: Record<string, string> = {}
    header.forEach((h, i) => (row[h.trim()] = (cells[i] ?? "").trim()))
    return row
  })
}

function severityFromFrp(frp: number): "urgent" | "high" | "medium" | "low" {
  if (frp >= 100) return "urgent"
  if (frp >= 30) return "high"
  if (frp >= 10) return "medium"
  return "low"
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const mapKey = Deno.env.get("FIRMS_MAP_KEY")
    if (!mapKey) {
      // Not an error — the scanner is simply dormant until a key is provided.
      return new Response(
        JSON.stringify({
          ok: false,
          configured: false,
          message:
            "NASA FIRMS is not configured. Add a free FIRMS_MAP_KEY secret (https://firms.modaps.eosdis.nasa.gov/api/map_key/) to start pulling active-fire detections.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Enforce the transaction quota before spending a data request.
    const current = await transactionCount(mapKey)
    if (current != null && current >= TRANSACTION_CAP) {
      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          throttled: true,
          current_transactions: current,
          message: `Skipped: NASA FIRMS transaction count (${current}) is at the ${TRANSACTION_CAP}/10-min cap.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${FIRMS_SOURCE}/${FIRMS_AREA}/${DAY_RANGE}`
    const res = await fetch(url, {
      headers: { "User-Agent": "WildfireCommand/1.0" },
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`FIRMS fetch failed (${res.status}): ${text.slice(0, 200)}`)
    }
    // An invalid key returns an HTML/text error page rather than CSV.
    if (!/latitude/i.test(text.split(/\r?\n/)[0] ?? "")) {
      throw new Error(`FIRMS returned an unexpected response — check that FIRMS_MAP_KEY is valid.`)
    }

    const rows = csvRows(text)
      .map((r) => ({
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        frp: Number(r.frp || 0),
        confidence: r.confidence || "",
        acqDate: r.acq_date || "",
        acqTime: r.acq_time || "",
        daynight: r.daynight || "",
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .sort((a, b) => b.frp - a.frp)
      .slice(0, MAX_DETECTIONS)

    const detections = rows.map((r) => {
      // Stable synthetic key so re-scans don't create duplicates.
      const key = `firms://${r.lat.toFixed(3)},${r.lng.toFixed(3)}@${r.acqDate}T${r.acqTime}`
      const when = r.acqTime.length === 4
        ? `${r.acqDate}T${r.acqTime.slice(0, 2)}:${r.acqTime.slice(2)}:00Z`
        : `${r.acqDate}T00:00:00Z`
      const generated = new Date(when)
      return {
        severity: severityFromFrp(r.frp),
        category: "wildfire" as const,
        headline: `[NASA FIRMS] Active fire detection near ${r.lat.toFixed(2)}, ${r.lng.toFixed(2)}`,
        summary: `VIIRS thermal anomaly detected ${r.acqDate} (${r.daynight === "N" ? "night" : "day"} pass). Fire radiative power ${r.frp.toFixed(1)} MW, confidence ${r.confidence || "n/a"}. Satellite hotspot from NASA FIRMS (near real-time) — indicates heat, not a confirmed incident. Verify with official sources.`,
        source: "NASA FIRMS",
        source_type: "rss" as const,
        latitude: r.lat,
        longitude: r.lng,
        content_url: key,
        generated_at: Number.isNaN(generated.getTime()) ? new Date().toISOString() : generated.toISOString(),
      }
    })

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    let inserted = 0
    if (detections.length > 0) {
      const keys = detections.map((d) => d.content_url)
      const { data: existing } = await db
        .from("alerts")
        .select("content_url")
        .in("content_url", keys)
      const existingKeys = new Set((existing ?? []).map((r: { content_url: string | null }) => r.content_url))
      const fresh = detections.filter((d) => !existingKeys.has(d.content_url))
      if (fresh.length > 0) {
        const { data, error } = await db.from("alerts").insert(fresh).select("id")
        if (error) throw new Error(error.message)
        inserted = data?.length ?? 0
      }
    }

    return new Response(
      JSON.stringify({ ok: true, configured: true, fetched: detections.length, inserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
