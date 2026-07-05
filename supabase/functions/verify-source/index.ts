import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIMEOUT_MS = 12000;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Probe a URL from the server (browsers can't do cross-origin checks) and report
// whether data can actually be pulled from it.
async function probe(url: string): Promise<{
  status: "ok" | "unreachable" | "error";
  detail: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "error", detail: "Malformed URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: "error", detail: "URL must use http or https." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WildfireCommand-SourceCheck/1.0", "Accept": "*/*" },
    });

    const contentType = (res.headers.get("content-type") || "unknown").split(";")[0].trim();
    const bodyText = await res.text();
    const bytes = new TextEncoder().encode(bodyText).length;

    if (!res.ok) {
      return { status: "unreachable", detail: `HTTP ${res.status} ${res.statusText}`.trim() };
    }
    if (bytes === 0) {
      return { status: "unreachable", detail: `HTTP ${res.status} · empty response` };
    }
    return { status: "ok", detail: `HTTP ${res.status} · ${contentType} · ${fmtBytes(bytes)}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.toLowerCase().includes("timeout")) {
      return { status: "unreachable", detail: `No response within ${TIMEOUT_MS / 1000}s.` };
    }
    return { status: "unreachable", detail: `Connection failed: ${msg.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const url = body?.url;
    const id = body?.id;
    if (!url || typeof url !== "string") {
      return json({ ok: false, error: "A 'url' is required." }, 400);
    }

    const result = await probe(url);
    const checkedAt = new Date().toISOString();

    // Persist the outcome onto the source row when an id is supplied. Uses the
    // service role since anon writes to data_sources are locked down by RLS.
    if (id && typeof id === "string") {
      const db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await db
        .from("data_sources")
        .update({
          verify_status: result.status,
          verify_detail: result.detail,
          verify_checked_at: checkedAt,
        })
        .eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 400);
    }

    return json({ ok: true, status: result.status, detail: result.detail, checked_at: checkedAt }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
