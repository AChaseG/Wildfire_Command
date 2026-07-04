import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Public Reddit RSS feeds — no API key required. Global wildfire coverage.
const REDDIT_FEEDS = [
  { url: "https://www.reddit.com/r/wildfires/.rss?limit=25", platform: "reddit", subreddit: "r/wildfires" },
  { url: "https://www.reddit.com/r/WildFireWatch/.rss?limit=25", platform: "reddit", subreddit: "r/WildFireWatch" },
  { url: "https://www.reddit.com/r/bushfire/.rss?limit=25", platform: "reddit", subreddit: "r/bushfire" },
  { url: "https://www.reddit.com/search.rss?q=wildfire+OR+bushfire+OR+%22forest+fire%22&sort=new&limit=30", platform: "reddit", subreddit: "Reddit (global search)" },
  { url: "https://www.reddit.com/r/worldnews/search.rss?q=wildfire+OR+bushfire&sort=new&restrict_sr=1&limit=25", platform: "reddit", subreddit: "r/worldnews" },
];

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>\\s*(?:<!\[CDATA\[)?([\\s\\S]*?)(?:\]\]>)?\\s*<\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]+${attr}="([^"]*)"`, "i");
  const m = re.exec(xml);
  return m ? m[1] : "";
}

function parseItems(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: extractTag(block, "title"),
      description: extractTag(block, "description"),
      link: extractTag(block, "link"),
      pubDate: extractTag(block, "pubDate"),
      author: extractTag(block, "author") || extractTag(block, "dc:creator"),
    });
  }
  return items;
}

// Severity classifier based on keywords
function classifySeverity(text: string): string {
  const lower = text.toLowerCase();
  if (/evacuation order|structure loss|fatali|trapped|life.threat|emergency declar/i.test(text)) return "urgent";
  if (/evacuat|evacuated|mandatory|red flag|extreme fire/i.test(text)) return "high";
  if (/fire behavior|containment|acr|spread|aerial/i.test(text)) return "medium";
  return "low";
}

function classifyCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/evacu/i.test(text)) return "evacuation";
  if (/air quality|aqi|smoke|particulate/i.test(text)) return "air_quality";
  if (/contain|suppression|crews/i.test(text)) return "containment";
  if (/wind|weather|red flag|relative humidity/i.test(text)) return "weather";
  return "wildfire";
}

// Only keep posts plausibly related to wildfires/fire incidents
function isFireRelated(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  return /wildfire|wild fire|brush fire|structure fire|prescribed fire|forest fire|fire crew|fire line|hotshot|air tanker|retardant|fire weather|fire ban|burn ban|smoke|evacuat|containment|acr.*burn|burned acres|incident command/i.test(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const imported: string[] = [];
    const rows: Record<string, unknown>[] = [];

    for (const feed of REDDIT_FEEDS) {
      let xml: string;
      try {
        const res = await fetch(feed.url, {
          headers: {
            "User-Agent": "WildfireCommandBot/1.0 (fire situational awareness tool)",
            "Accept": "application/rss+xml, application/xml, text/xml",
          },
        });
        if (!res.ok) continue;
        xml = await res.text();
      } catch {
        continue;
      }

      const items = parseItems(xml);
      for (const item of items) {
        const title = item.title || "";
        const body = item.description || "";
        if (!isFireRelated(title, body)) continue;

        const link = item.link || "";
        // Deduplicate by content URL
        if (link && imported.includes(link)) continue;
        if (link) imported.push(link);

        // Strip HTML tags from description
        const summary = body
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 600);

        rows.push({
          headline: title.slice(0, 200) || "Fire-related post",
          summary: summary || title,
          severity: classifySeverity(`${title} ${summary}`),
          category: classifyCategory(`${title} ${summary}`),
          source: `${feed.subreddit} (Reddit)`,
          source_type: "social",
          social_platform: "reddit",
          content_url: link || null,
          generated_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          acknowledged: false,
        });
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: "No new fire-related posts found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Avoid duplicate inserts — check existing content_url values
    const urls = rows.filter((r) => r.content_url).map((r) => r.content_url as string);
    let existingUrls: string[] = [];
    if (urls.length > 0) {
      const { data: existing } = await supabase
        .from("alerts")
        .select("content_url")
        .in("content_url", urls);
      existingUrls = (existing || []).map((r) => r.content_url).filter(Boolean);
    }

    const newRows = rows.filter(
      (r) => !r.content_url || !existingUrls.includes(r.content_url as string),
    );

    if (newRows.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, message: "All posts already imported" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await supabase.from("alerts").insert(newRows);
    if (insertError) throw new Error(insertError.message);

    return new Response(
      JSON.stringify({ inserted: newRows.length, total_scanned: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
