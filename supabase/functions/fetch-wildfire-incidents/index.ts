import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// NIFC WFIGS "Current Wildland Fire Locations" — public interagency incident
// feed (ArcGIS Feature Service, no API key). Point geometry in WGS84.
// https://data-nifc.opendata.arcgis.com/
const WFIGS_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query";

// Largest active US wildfires first; cap the pull so a single scan stays light.
const MAX_INCIDENTS = 300;

type Attr = Record<string, unknown>;

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(attr: Attr, keys: string[]): unknown {
  for (const k of keys) {
    if (attr[k] != null && attr[k] !== "") return attr[k];
  }
  return null;
}

function severityFromAcres(acres: number): "low" | "moderate" | "high" | "extreme" {
  if (acres >= 50000) return "extreme";
  if (acres >= 10000) return "high";
  if (acres >= 1000) return "moderate";
  return "low";
}

function statusFrom(attr: Attr, containment: number): "active" | "contained" | "controlled" | "out" {
  const out = pick(attr, ["FireOutDateTime", "ControlDateTime"]);
  if (out) return "out";
  const containedAt = pick(attr, ["ContainmentDateTime"]);
  if (containedAt || containment >= 100) return "contained";
  return "active";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const params = new URLSearchParams({
      where: "IncidentTypeCategory = 'WF'",
      outFields: [
        "IrwinID", "IncidentName", "IncidentTypeCategory",
        "FireDiscoveryDateTime", "ContainmentDateTime", "FireOutDateTime", "ControlDateTime",
        "PercentContained", "IncidentSize", "DiscoveryAcres",
        "POOState", "POOCounty", "IncidentShortDescription", "FireCause",
      ].join(","),
      returnGeometry: "true",
      outSR: "4326",
      orderByFields: "IncidentSize DESC",
      resultRecordCount: String(MAX_INCIDENTS),
      f: "json",
    });

    const res = await fetch(`${WFIGS_URL}?${params.toString()}`, {
      headers: { "User-Agent": "WildfireCommand/1.0", "Accept": "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`WFIGS fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    let payload: { features?: Array<{ attributes?: Attr; geometry?: { x?: number; y?: number } }> };
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("WFIGS returned a non-JSON response.");
    }
    const features = payload.features ?? [];

    const rows = features
      .map((f) => {
        const attr = f.attributes ?? {};
        const lng = num(f.geometry?.x);
        const lat = num(f.geometry?.y);
        const externalId = pick(attr, ["IrwinID"]);
        if (lat == null || lng == null || !externalId) return null;

        const acres = Math.max(
          0,
          Math.round(num(pick(attr, ["IncidentSize", "DiscoveryAcres"])) ?? 0),
        );
        const contRaw = num(pick(attr, ["PercentContained"])) ?? 0;
        const containment = Math.min(100, Math.max(0, Math.round(contRaw)));
        const discovery = num(pick(attr, ["FireDiscoveryDateTime"]));
        const startedAt = discovery ? new Date(discovery).toISOString() : new Date().toISOString();
        const name = String(pick(attr, ["IncidentName"]) ?? "Unnamed incident").trim();
        const state = String(pick(attr, ["POOState"]) ?? "").replace("US-", "");
        const county = pick(attr, ["POOCounty"]);
        const locParts = [county ? `${county} County` : null, state || null].filter(Boolean);
        const cause = pick(attr, ["FireCause"]);
        const shortDesc = pick(attr, ["IncidentShortDescription"]);
        const summaryParts = [
          `${acres.toLocaleString()} acres, ${containment}% contained.`,
          cause ? `Cause: ${cause}.` : null,
          shortDesc ? String(shortDesc) : null,
        ].filter(Boolean);

        return {
          external_id: String(externalId),
          name: `${name} Fire`.replace(/\s*Fire\s*Fire$/i, " Fire"),
          severity: severityFromAcres(acres),
          status: statusFrom(attr, containment),
          containment_pct: containment,
          acreage_burned: acres,
          started_at: startedAt,
          latitude: lat,
          longitude: lng,
          location_description: locParts.join(", ") || null,
          summary: summaryParts.join(" "),
          source: "NIFC WFIGS",
          source_url: "https://data-nifc.opendata.arcgis.com/",
          updated_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, fetched: 0, upserted: 0, message: "No WFIGS incidents returned." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await db
      .from("wildfires")
      .upsert(rows, { onConflict: "external_id" })
      .select("id");
    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ ok: true, fetched: rows.length, upserted: data?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
