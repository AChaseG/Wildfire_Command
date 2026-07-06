import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser, type Element } from "jsr:@b-fuze/deno-dom@0.1.48";
import { safeFetch } from "../_shared/ssrf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIMEOUT_MS = 12000;
const MAX_RESULTS = 6; // how many search hits to scrape per query
const MAX_INCIDENTS = 80;

function clean(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function extractIncidents(text: string, into: Map<string, { name: string; acres: string | null; containment: number | null; source: string }>, sourceUrl: string) {
  const nameRe = /([A-Z][A-Za-z0-9.'\-]*(?:\s+[A-Za-z0-9.'\-]+){0,5}?\s(?:Fire|Complex|Incident))/g;
  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text)) !== null && into.size < MAX_INCIDENTS) {
    const name = clean(m[1]);
    const key = name.toLowerCase();
    if (name.length < 5 || into.has(key)) continue;
    const window = text.slice(Math.max(0, m.index - 160), m.index + name.length + 160);
    const acresMatch = window.match(/([\d,]{2,})\s*acres/i);
    const containMatch = window.match(/(\d{1,3})\s*%\s*contain/i);
    into.set(key, {
      name,
      acres: acresMatch ? acresMatch[1].replace(/,/g, "") : null,
      containment: containMatch ? Math.min(100, parseInt(containMatch[1], 10)) : null,
      source: sourceUrl,
    });
  }
}

async function scrapePage(url: string, incidents: Map<string, { name: string; acres: string | null; containment: number | null; source: string }>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WildfireCommand-Scraper/1.0", "Accept": "text/html,*/*" },
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return;
    const bodyText = clean((doc.querySelector("body") as unknown as Element)?.textContent).slice(0, 200000);
    extractIncidents(bodyText, incidents, url);
  } catch {
    // A single unreachable result should not fail the whole search.
  } finally {
    clearTimeout(timer);
  }
}

async function runSearch(query: string, apiKey: string, endpoint: string) {
  const url = `${endpoint}/v7.0/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}&responseFilter=Webpages&mkt=en-US&safeSearch=Off`;
  const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bing search failed (${res.status}): ${text.slice(0, 180)}`);
  let payload: { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string }> } };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Bing returned a non-JSON response.");
  }
  return (payload.webPages?.value ?? []).filter((r) => r.url).slice(0, MAX_RESULTS);
}

// deno-lint-ignore no-explicit-any
async function searchAndStore(db: any, id: string, query: string, apiKey: string, endpoint: string) {
  let row;
  try {
    const results = await runSearch(query, apiKey, endpoint);
    const incidents = new Map<string, { name: string; acres: string | null; containment: number | null; source: string }>();
    await Promise.allSettled(results.map((r) => scrapePage(r.url!, incidents)));

    const links = results.map((r) => ({ text: clean(r.name) || r.url!, href: r.url!, snippet: clean(r.snippet) }));
    const incidentList = [...incidents.values()];
    row = {
      data_source_id: id,
      title: `Search: ${query}`,
      description: `${results.length} result${results.length === 1 ? "" : "s"} scraped from web search.`,
      item_count: incidentList.length,
      data: {
        title: `Search: ${query}`,
        query,
        headings: [],
        links,
        incidents: incidentList,
        excerpt: links.map((l) => l.snippet).filter(Boolean).join(" ").slice(0, 600),
      },
      status: "ok",
      error: null,
      scraped_at: new Date().toISOString(),
    };
  } catch (err) {
    row = {
      data_source_id: id,
      title: null,
      description: null,
      item_count: 0,
      data: {},
      status: "error",
      error: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      scraped_at: new Date().toISOString(),
    };
  }

  const { data, error } = await db
    .from("scraped_pages")
    .upsert(row, { onConflict: "data_source_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("AZURE_BING_SEARCH_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "AZURE_BING_SEARCH_KEY is not configured." }, 400);
    }
    const endpoint = (Deno.env.get("AZURE_BING_SEARCH_ENDPOINT") || "https://api.bing.microsoft.com").replace(/\/+$/, "");

    const body = await req.json().catch(() => null);
    const id = body?.id;
    const query = body?.query;

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Batch mode: no explicit id/query -> run every enabled search source.
    if (!id || !query) {
      const { data: sources, error } = await db
        .from("data_sources")
        .select("id, search_query")
        .eq("enabled", true)
        .eq("source_kind", "search");
      if (error) return json({ ok: false, error: error.message }, 400);

      const rows = (sources || []).filter((s: { search_query: string | null }) => s.search_query);
      const results = await Promise.allSettled(
        rows.map((s: { id: string; search_query: string }) => searchAndStore(db, s.id, s.search_query, apiKey, endpoint)),
      );
      const scraped = results.filter((r) => r.status === "fulfilled").length;
      return json({ ok: true, scraped, total: rows.length }, 200);
    }

    if (typeof id !== "string" || typeof query !== "string") {
      return json({ ok: false, error: "'id' and 'query' must be strings." }, 400);
    }
    const page = await searchAndStore(db, id, query, apiKey, endpoint);
    return json({ ok: true, page }, 200);
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
