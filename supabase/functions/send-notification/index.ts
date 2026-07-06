import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SLACK_POST_MESSAGE = "https://slack.com/api/chat.postMessage";

// Posts a monitored-incident update to Slack via the Web API. The bot token is
// held server-side (SLACK_BOT_TOKEN); the destination channel and the on/off
// switch are read from notification_settings server-side. The caller only
// supplies the message text, so this cannot be used to post to an arbitrary
// channel or workspace (unlike the old client-supplied-webhook relay).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("SLACK_BOT_TOKEN");
    if (!token) return json({ error: "SLACK_BOT_TOKEN is not configured." }, 400);

    const { text, blocks } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string") {
      return json({ error: "Message text is required." }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: cfg, error: cfgErr } = await db
      .from("notification_settings")
      .select("slack_channel_id, enabled")
      .eq("id", "default")
      .maybeSingle();
    if (cfgErr) return json({ error: cfgErr.message }, 400);
    if (!cfg?.enabled) return json({ ok: false, skipped: "notifications disabled" }, 200);
    if (!cfg?.slack_channel_id) return json({ error: "No Slack channel configured." }, 400);

    const slackRes = await fetch(SLACK_POST_MESSAGE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: cfg.slack_channel_id,
        text,
        ...(Array.isArray(blocks) ? { blocks } : {}),
      }),
    });

    // chat.postMessage returns HTTP 200 with { ok: false, error } on failure, so
    // the body must be inspected rather than relying on the status code.
    const payload = await slackRes.json().catch(() => null);
    if (!payload?.ok) {
      const detail = payload?.error || `HTTP ${slackRes.status}`;
      return json({ error: `Slack rejected the message: ${detail}` }, 502);
    }

    return json({ ok: true, ts: payload.ts, channel: payload.channel }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
