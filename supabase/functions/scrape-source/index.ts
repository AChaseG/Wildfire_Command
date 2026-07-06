import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser, type Element } from "jsr:@b-fuze/deno-dom@0.1.48";
import { assertPublicUrl, safeFetch } from "../_shared/ssrf.ts";

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

function titleCaseName(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type Incident = {
  name: string;
  acres: string | null;
  containment: number | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
};

// Many wildfire trackers (e.g. WFCA) are Next.js apps that embed the incident
// record as JSON in a __NEXT_DATA__ script. When present, parse it directly for
// reliable structured data instead of guessing from rendered text.
// deno-lint-ignore no-explicit-any
function extractNextDataIncidents(html: string): Incident[] | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const props = parsed?.props?.pageProps;
  if (!props) return null;
  const list: any[] = Array.isArray(props.ssrFires)
    ? props.ssrFires
    : Array.isArray(props.fires)
    ? props.fires
    : props.ssrFire
    ? [props.ssrFire]
    : props.fire
    ? [props.fire]
    : [];
  const incidents: Incident[] = [];
  for (const f of list) {
    const rawName = f?.incidentname;
    if (!rawName) continue;
    const name = titleCaseName(String(rawName));
    const county = f.poocounty ? `${f.poocounty} County` : "";
    const state = f.poostate ? String(f.poostate).replace(/^US-/, "") : "";
    incidents.push({
      name: /fire|complex|incident/i.test(name) ? name : `${name} Fire`,
      acres: f.acres != null ? String(Math.round(Number(f.acres))) : null,
      containment: f.percentcontained != null ? Math.min(100, Math.round(Number(f.percentcontained))) : null,
      location: [county, state].filter(Boolean).join(", ") || null,
      lat: typeof f.lat === "number" ? f.lat : null,
      lng: typeof f.lng === "number" ? f.lng : null,
    });
  }
  return incidents.length ? incidents : null;
}

// Detect wildfire incidents in the page text: named fires plus any acreage /
// containment figures that appear near the name.
function extractIncidents(text: string): Incident[] {
  const nameRe = /([A-Z][A-Za-z0-9.'\-]*(?:\s+[A-Za-z0-9.'\-]+){0,5}?\s(?:Fire|Complex|Incident))/g;
  const seen = new Set<string>();
  const incidents: Incident[] = [];

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

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeXml(m[1]) : "";
}

// Parse an RSS/Atom feed (e.g. InciWeb) into incidents. Names carry a leading
// unit code (e.g. "COPSF Aspen Acres Fire") which is stripped; acreage,
// containment and state are read from the item description when present.
function parseFeed(xml: string, baseUrl: string) {
  const channelTitle = tag(xml.replace(/<item[\s\S]*/i, ""), "title") ||
    tag(xml.replace(/<entry[\s\S]*/i, ""), "title");
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  const incidents: Incident[] = [];
  const links: { text: string; href: string }[] = [];
  for (const b of blocks.slice(0, MAX_INCIDENTS)) {
    const rawTitle = tag(b, "title");
    if (!rawTitle) continue;
    const link = tag(b, "link");
    const desc = tag(b, "description") || tag(b, "summary") || tag(b, "content");
    const name = rawTitle.replace(/^[A-Z]{2,7}\s+(?=[A-Z])/, "").trim();
    const acresMatch = desc.match(/([\d,]{2,})\s*acres/i);
    const containMatch = desc.match(/(\d{1,3})\s*%\s*contain/i);
    const stateMatch = desc.match(/State:\s*([A-Za-z][A-Za-z .]+?)(?:\s*(?:---|Coordinates|$))/i);
    incidents.push({
      name: /fire|complex|incident/i.test(name) ? name : `${name} Fire`,
      acres: acresMatch ? acresMatch[1].replace(/,/g, "") : null,
      containment: containMatch ? Math.min(100, parseInt(containMatch[1], 10)) : null,
      location: stateMatch ? stateMatch[1].trim() : null,
    });
    if (link && links.length < MAX_LINKS) {
      try {
        links.push({ text: rawTitle.slice(0, 120), href: new URL(link, baseUrl).toString() });
      } catch {
        // skip malformed link
      }
    }
  }
  return { title: channelTitle, incidents, links };
}

async function scrape(url: string, baseUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WildfireCommand-Scraper/1.0", "Accept": "text/html,*/*" },
    });
    if (!res.ok) {
      return { status: "error" as const, error: `HTTP ${res.status} ${res.statusText}`.trim() };
    }
    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();

    const looksLikeFeed = /xml|rss|atom/i.test(contentType) || /^\s*(<\?xml|<rss\b|<feed\b)/i.test(raw.slice(0, 500));
    if (looksLikeFeed) {
      const feed = parseFeed(raw, baseUrl);
      const description = feed.incidents.length
        ? `${feed.incidents.length} incidents from feed.`
        : "";
      return {
        status: "ok" as const,
        title: feed.title,
        description,
        item_count: feed.incidents.length,
        data: { title: feed.title, description, headings: [], links: feed.links, incidents: feed.incidents, excerpt: "" },
      };
    }

    if (!contentType.includes("html") && !/<html|<!doctype html/i.test(raw.slice(0, 500))) {
      return { status: "error" as const, error: `Not an HTML page (${contentType.split(";")[0] || "unknown"}).` };
    }

    const html = raw;
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
    const incidents = extractNextDataIncidents(html) ?? extractIncidents(bodyText);

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
  let result: Awaited<ReturnType<typeof scrape>>;
  try {
    const parsed = await assertPublicUrl(url);
    result = await scrape(url, parsed.origin);
  } catch (err) {
    result = { status: "error", error: err instanceof Error ? err.message : "Malformed URL." };
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
