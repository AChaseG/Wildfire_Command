import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// PurpleAir real-time outdoor PM2.5 sensors. Needs a free API key:
//   https://develop.purpleair.com/  ->  add it as the PURPLEAIR_API_KEY secret.
// We pull outdoor sensors across the continental US in one call, then attribute
// the nearest recent reading to each active wildfire and store it as a US AQI.
const US_BBOX = { nwlng: -125, nwlat: 49.5, selng: -66.5, selat: 24.5 };
const MATCH_RADIUS_KM = 40;
const MAX_UPDATES = 400;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// US EPA PM2.5 (µg/m³) -> AQI, piecewise-linear across the standard breakpoints.
function aqiFromPm25(pm: number): number | null {
  if (!Number.isFinite(pm) || pm < 0) return null;
  const bp: [number, number, number, number][] = [
    [0.0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];
  const c = Math.min(pm, 500.4);
  for (const [cLow, cHigh, aLow, aHigh] of bp) {
    if (c >= cLow && c <= cHigh) {
      return Math.round(((aHigh - aLow) / (cHigh - cLow)) * (c - cLow) + aLow);
    }
  }
  return 500;
}

type Sensor = { lat: number; lng: number; pm: number };

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("PURPLEAIR_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          configured: false,
          message:
            "PurpleAir is not configured. Add a free PURPLEAIR_API_KEY secret (https://develop.purpleair.com/) to pull live air-quality readings.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams({
      fields: "pm2.5_60minute,latitude,longitude",
      location_type: "0",
      max_age: "3600",
      nwlng: String(US_BBOX.nwlng),
      nwlat: String(US_BBOX.nwlat),
      selng: String(US_BBOX.selng),
      selat: String(US_BBOX.selat),
    });
    const res = await fetch(`https://api.purpleair.com/v1/sensors?${params.toString()}`, {
      headers: { "X-API-Key": apiKey, "User-Agent": "WildfireCommand/1.0" },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`PurpleAir fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    let payload: { fields?: string[]; data?: unknown[][] };
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("PurpleAir returned a non-JSON response — check that PURPLEAIR_API_KEY is valid.");
    }
    const fields = payload.fields ?? [];
    const latIdx = fields.indexOf("latitude");
    const lngIdx = fields.indexOf("longitude");
    const pmIdx = fields.indexOf("pm2.5_60minute");
    if (latIdx < 0 || lngIdx < 0 || pmIdx < 0) {
      throw new Error("PurpleAir response missing expected fields.");
    }

    const sensors: Sensor[] = (payload.data ?? [])
      .map((row) => ({
        lat: Number(row[latIdx]),
        lng: Number(row[lngIdx]),
        pm: Number(row[pmIdx]),
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.pm));

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fires } = await db
      .from("wildfires")
      .select("id,latitude,longitude,air_quality")
      .neq("status", "out");

    // For each active fire, average the sensors within the match radius and
    // convert to AQI. Skip fires with no nearby sensor or an unchanged value.
    const updates: { id: string; air_quality: number }[] = [];
    for (const f of fires ?? []) {
      const fLat = Number(f.latitude);
      const fLng = Number(f.longitude);
      if (!Number.isFinite(fLat) || !Number.isFinite(fLng)) continue;
      let sum = 0;
      let count = 0;
      for (const s of sensors) {
        if (haversineKm(fLat, fLng, s.lat, s.lng) <= MATCH_RADIUS_KM) {
          sum += s.pm;
          count++;
        }
      }
      if (count === 0) continue;
      const aqi = aqiFromPm25(sum / count);
      if (aqi == null || aqi === f.air_quality) continue;
      updates.push({ id: f.id, air_quality: aqi });
    }

    const capped = updates.slice(0, MAX_UPDATES);
    let updated = 0;
    await mapWithConcurrency(capped, 12, async (u) => {
      const { error } = await db
        .from("wildfires")
        .update({ air_quality: u.air_quality, updated_at: new Date().toISOString() })
        .eq("id", u.id);
      if (!error) updated++;
    });

    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        sensors: sensors.length,
        matched: updates.length,
        updated,
      }),
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
