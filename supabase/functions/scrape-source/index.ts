import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser, type Element } from "jsr:@b-fuze/deno-dom@0.1.48";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TIMEOUT_MS = 15000;
const MAX_HEADINGS = 40;
const MAX_LINKS = 80;
const MAX_INCIDENTS = 60;

function clean(text: string | null | undefined): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

// Detect wildfire incidents in the page text: named fires plus any acreage /
// containment figures that appear near the name.
function extractIncidents(text: string) {
  const nameRe = /([A-Z][A-Za-z0-9.'\-]*(?:\s+[A-Za-z0-9.'\-]+){0,5}?\s(?:Fire|Complex|Incident))/g;
  const seen = new Set<string>();
  const incidents: { name: string; acres: string | null; containment: number | null }[] = [];

  let m: RegExpExecArray | null;
  while ((m = nameRe.exec(text)) !== null && incidents.length < MAX_INCIDENTS) {
    const name = clean(m[1]);
    const key = name.toLowerCase();
    if (name.length < 5 || seen.has(key)) continue;
    seen.add(key);

    const window = text.slice(Math.max(0, m.index - 160), m.index + name.length + 160);
    const acresMatch = window.match(/([\d,]{2,})\s*acres/i);
    const containMatch = window.match(/(\d{1,3})\s*%\s*contain/i);

    incidents.push({
      name,
      acres: acresMatch ? acresMatch[1].replace(/,/g, "") : null,
      containment: containMatch ? Math.min(100, parseInt(containMatch[1], 10)) : null,
    });
  }
  return incidents;
}

async function scrape(url: string, baseUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WildfireCommand-Scraper/1.0", "Accept": "text/html,*/*" },
    });
    if (!res.ok) {
      return { status: "error" as const, error: `HTTP ${res.status} ${res.statusText}`.trim() };
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return { status: "error" as const, error: `Not an HTML page (${contentType.split(";")[0] || "unknown"}).` };
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return { status: "error" as const, error: "Could not parse HTML." };

    const title = clean(doc.querySelector("title")?.textContent);
    const description = clean(
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
        doc.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    );

    const headings: { level: number; text: string }[] = [];
    for (const el of doc.querySelectorAll("h1, h2, h3")) {
      const text = clean((el as unknown as Element).textContent);
      if (text) headings.push({ level: Number((el as unknown as Element).tagName.slice(1)), text });
      if (headings.length >= MAX_HEADINGS) break;
    }

    const links: { text: string; href: string }[] = [];
    const seenHref = new Set<string>();
    for (const el of doc.querySelectorAll("a[href]")) {
      const raw = (el as unknown as Element).getAttribute("href") || "";
      if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) continue;
      let href: string;
      try {
        href = new URL(raw, baseUrl).toString();
      } catch {
        continue;
      }
      if (seenHref.has(href)) continue;
      const text = clean((el as unknown as Element).textContent);
      if (!text) continue;
      seenHref.add(href);
      links.push({ text: text.slice(0, 120), href });
      if (links.length >= MAX_LINKS) break;
    }

    const bodyText = clean(doc.querySelector("body")?.textContent).slice(0, 200000);
    const incidents = extractIncidents(bodyText);

    return {
      status: "ok" as const,
      title,
      description,
      item_count: incidents.length,
      data: { title, description, headings, links, incidents, excerpt: bodyText.slice(0, 600) },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted")) return { status: "error" as const, error: `No response within ${TIMEOUT_MS / 1000}s.` };
    return { status: "error" as const, error: msg.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const id = body?.id;
    const url = body?.url;

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Batch mode: no explicit id/url -> scrape every enabled URL source.
    if (!id || !url) {
      const { data: sources, error } = await db
        .from("data_sources")
        .select("id, url")
        .eq("enabled", true)
        .eq("source_kind", "url");
      if (error) return json({ ok: false, error: error.message }, 400);

      const results = await Promise.allSettled(
        (sources || []).map((s: { id: string; url: string }) => scrapeAndStore(db, s.id, s.url)),
      );
      const scraped = results.filter((r) => r.status === "fulfilled").length;
      return json({ ok: true, scraped, total: sources?.length || 0 }, 200);
    }

    // Single mode (manual UI trigger).
    if (typeof id !== "string" || typeof url !== "string") {
      return json({ ok: false, error: "'id' and 'url' must be strings." }, 400);
    }
    const page = await scrapeAndStore(db, id, url);
    if (!page) return json({ ok: false, error: "Could not store scrape result." }, 400);
    return json({ ok: true, page }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function scrapeAndStore(db: any, id: string, url: string) {
  let origin: string;
  let result: Awaited<ReturnType<typeof scrape>>;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      result = { status: "error", error: "URL must use http or https." };
    } else {
      origin = parsed.origin;
      result = await scrape(url, origin);
    }
  } catch {
    result = { status: "error", error: "Malformed URL." };
  }

  const row = {
    data_source_id: id,
    title: result.status === "ok" ? result.title : null,
    description: result.status === "ok" ? result.description : null,
    item_count: result.status === "ok" ? result.item_count : 0,
    data: result.status === "ok" ? result.data : {},
    status: result.status,
    error: result.status === "error" ? result.error : null,
    scraped_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("scraped_pages")
    .upsert(row, { onConflict: "data_source_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
