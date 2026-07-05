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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

    // Snapshot the current state of these incidents so we can log what actually
    // changed (acreage, containment, severity, status) into the updates feed.
    const extIds = rows.map((r) => r.external_id);
    const { data: existing } = await db
      .from("wildfires")
      .select("id,external_id,acreage_burned,containment_pct,severity,status")
      .in("external_id", extIds);
    const prevByExt = new Map(
      (existing ?? []).map((f) => [f.external_id as string, f]),
    );

    const { data, error } = await db
      .from("wildfires")
      .upsert(rows, { onConflict: "external_id" })
      .select("id,external_id");
    if (error) throw new Error(error.message);
    const idByExt = new Map(
      (data ?? []).map((f) => [f.external_id as string, f.id as string]),
    );

    const now = new Date().toISOString();
    const updates: Array<{
      fire_id: string;
      posted_at: string;
      title: string;
      content: string;
      category: string;
    }> = [];

    for (const row of rows) {
      const fireId = idByExt.get(row.external_id);
      if (!fireId) continue;
      const prev = prevByExt.get(row.external_id);

      if (!prev) {
        // Newly ingested incident — record its discovery as the first update.
        updates.push({
          fire_id: fireId,
          posted_at: row.started_at,
          title: "Incident reported",
          content: `New wildfire reported${row.location_description ? ` near ${row.location_description}` : ""} at ${row.acreage_burned.toLocaleString()} acres, ${row.containment_pct}% contained.`,
          category: "general",
        });
        continue;
      }

      const prevAcres = Number(prev.acreage_burned) || 0;
      if (row.acreage_burned > prevAcres) {
        const delta = row.acreage_burned - prevAcres;
        updates.push({
          fire_id: fireId,
          posted_at: now,
          title: `Fire grew to ${row.acreage_burned.toLocaleString()} acres`,
          content: `Burned area increased by ${delta.toLocaleString()} acres (was ${prevAcres.toLocaleString()}).`,
          category: "general",
        });
      } else if (row.acreage_burned < prevAcres) {
        updates.push({
          fire_id: fireId,
          posted_at: now,
          title: `Acreage revised to ${row.acreage_burned.toLocaleString()} acres`,
          content: `Reported burned area revised down from ${prevAcres.toLocaleString()} acres.`,
          category: "general",
        });
      }

      const prevCont = Number(prev.containment_pct) || 0;
      if (row.containment_pct !== prevCont) {
        const dir = row.containment_pct > prevCont ? "increased" : "decreased";
        updates.push({
          fire_id: fireId,
          posted_at: now,
          title: `Containment ${dir} to ${row.containment_pct}%`,
          content: `Containment ${dir} from ${prevCont}% to ${row.containment_pct}%.`,
          category: "containment",
        });
      }

      if (row.severity !== prev.severity) {
        updates.push({
          fire_id: fireId,
          posted_at: now,
          title: `Severity reclassified to ${cap(row.severity)}`,
          content: `Incident severity changed from ${prev.severity} to ${row.severity}.`,
          category: "general",
        });
      }

      if (row.status !== prev.status) {
        const contained = row.status === "contained" || row.status === "controlled" || row.status === "out";
        updates.push({
          fire_id: fireId,
          posted_at: now,
          title: `Status changed to ${cap(row.status)}`,
          content: `Incident status updated from ${prev.status} to ${row.status}.`,
          category: contained ? "containment" : "general",
        });
      }
    }

    let logged = 0;
    if (updates.length > 0) {
      const { error: upErr, count } = await db
        .from("fire_updates")
        .insert(updates, { count: "exact" });
      if (upErr) throw new Error(upErr.message);
      logged = count ?? updates.length;
    }

    return new Response(
      JSON.stringify({ ok: true, fetched: rows.length, upserted: data?.length ?? 0, updatesLogged: logged }),
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
