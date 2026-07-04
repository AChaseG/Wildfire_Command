import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

const GDACS_RSS = "https://www.gdacs.org/xml/rss.xml"

// Extract text content from an XML/HTML tag
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i")
  const m = xml.match(re)
  if (!m) return ""
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim()
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, "i")
  const m = xml.match(re)
  return m ? m[1] : ""
}

// Parse GDACS georss:point "lat lng" string
function parseGeoRSS(xml: string): { lat: number; lng: number } | null {
  const re = /<georss:point>([\s\S]*?)<\/georss:point>/i
  const m = xml.match(re)
  if (!m) return null
  const parts = m[1].trim().split(/\s+/)
  if (parts.length < 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

// Map GDACS alert level to our severity
function gdacsLevel(xml: string): "flash" | "urgent" | "high" | "medium" | "low" {
  const level = extractAttr(xml, "gdacs:alertlevel", "xmlns:gdacs") || ""
  const text = (extractTag(xml, "gdacs:alertlevel") || "").toLowerCase()
  if (text === "red") return "urgent"
  if (text === "orange") return "high"
  if (text === "green") return "medium"
  // Try reading the value from the tag content as fallback
  return "low"
}

function gdacsSeverityFromText(txt: string): "flash" | "urgent" | "high" | "medium" | "low" {
  const t = txt.toLowerCase()
  if (t.includes("red")) return "urgent"
  if (t.includes("orange")) return "high"
  if (t.includes("green")) return "medium"
  return "low"
}

// Extract all <item> blocks from the RSS XML
function extractItems(xml: string): string[] {
  const items: string[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    items.push(m[1])
  }
  return items
}

// Determine if an item is fire/wildfire related
function isFireRelated(item: string): boolean {
  const title = extractTag(item, "title").toLowerCase()
  const desc = extractTag(item, "description").toLowerCase()
  const eventType = extractTag(item, "gdacs:eventtype").toLowerCase()
  const keywords = ["fire", "wildfire", "forest fire", "bushfire", "wf"]
  return keywords.some(
    (kw) => title.includes(kw) || desc.includes(kw) || eventType.includes(kw),
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const db = createClient(supabaseUrl, serviceKey)

    // Fetch GDACS RSS
    const rssRes = await fetch(GDACS_RSS, {
      headers: { "User-Agent": "WildfireCommand/1.0 (+https://example.com)" },
    })
    if (!rssRes.ok) {
      throw new Error(`GDACS fetch failed: ${rssRes.status}`)
    }
    const rssXml = await rssRes.text()
    const items = extractItems(rssXml)

    // Filter to fire-related items only, or all if none found (graceful fallback)
    let fireItems = items.filter(isFireRelated)
    if (fireItems.length === 0) {
      // Take up to 5 most recent items of any type as general emergency alerts
      fireItems = items.slice(0, 5)
    }

    const alertsToInsert = fireItems.slice(0, 15).map((item) => {
      const title = extractTag(item, "title") || "GDACS Event"
      const description = extractTag(item, "description") || ""
      const link = extractTag(item, "link") || ""
      const pubDate = extractTag(item, "pubDate")
      const geo = parseGeoRSS(item)
      const levelRaw = extractTag(item, "gdacs:alertlevel")
      const severity = gdacsSeverityFromText(levelRaw || "")
      const eventType = extractTag(item, "gdacs:eventtype") || "General"
      const country = extractTag(item, "gdacs:country") || ""

      const headline = `[GDACS] ${title}${country ? ` — ${country}` : ""}`
      const summary = [
        description.slice(0, 300),
        description.length > 300 ? "…" : "",
        `Alert level: ${levelRaw || "unknown"}.`,
        `Source: GDACS Global Disaster Alert and Coordination System (gdacs.org). This is an RSS-imported alert — verify with official sources before acting.`,
      ]
        .filter(Boolean)
        .join(" ")

      return {
        severity,
        category: "wildfire" as const,
        headline,
        summary,
        source: "GDACS",
        source_type: "rss" as const,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
        content_url: link || null,
        generated_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    })

    let inserted = 0
    if (alertsToInsert.length > 0) {
      // Deduplicate against alerts already imported (match on content_url).
      const urls = alertsToInsert
        .map((a) => a.content_url)
        .filter((u): u is string => Boolean(u))
      let existingUrls: string[] = []
      if (urls.length > 0) {
        const { data: existing } = await db
          .from("alerts")
          .select("content_url")
          .in("content_url", urls)
        existingUrls = (existing ?? [])
          .map((r: { content_url: string | null }) => r.content_url)
          .filter((u): u is string => Boolean(u))
      }
      const newAlerts = alertsToInsert.filter(
        (a) => !a.content_url || !existingUrls.includes(a.content_url),
      )
      if (newAlerts.length > 0) {
        const { data, error } = await db
          .from("alerts")
          .insert(newAlerts)
          .select("id")
        if (error) throw new Error(error.message)
        inserted = data?.length ?? 0
      }
    }

    return new Response(
      JSON.stringify({ ok: true, fetched: fireItems.length, inserted }),
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
