import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveFireStatus, type UpdateLike } from "../_shared/fireStatus.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// How many recent updates per fire to scan for "out"/"fully contained" wording.
const MAX_UPDATES_PER_FIRE = 20;

// Scans every active incident and clears the active status of any fire whose own
// data shows it is fully contained (100%) or out, reclassifying it to
// "contained" or "out" and logging the change to the updates feed. Idempotent:
// a fire already resolved is skipped on the next run.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fires, error } = await db
      .from("wildfires")
      .select("id, name, status, containment_pct, ended_at")
      .eq("status", "active");
    if (error) return json({ ok: false, error: error.message }, 400);
    if (!fires || fires.length === 0) return json({ ok: true, scanned: 0, resolved: 0 }, 200);

    // Pull recent updates for these fires in one query, newest first, and bucket
    // them per fire (capped) so the parser can read the narrative signals.
    const ids = fires.map((f: { id: string }) => f.id);
    const { data: updateRows } = await db
      .from("fire_updates")
      .select("fire_id, title, content, posted_at")
      .in("fire_id", ids)
      .order("posted_at", { ascending: false });

    const updatesByFire = new Map<string, UpdateLike[]>();
    for (const u of updateRows ?? []) {
      const list = updatesByFire.get(u.fire_id) ?? [];
      if (list.length < MAX_UPDATES_PER_FIRE) {
        list.push({ title: u.title, content: u.content });
        updatesByFire.set(u.fire_id, list);
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const logs: Array<Record<string, unknown>> = [];
    let resolved = 0;

    for (const fire of fires) {
      const res = resolveFireStatus(fire, updatesByFire.get(fire.id) ?? [], now);
      if (!res || res.status === fire.status) continue;

      const patch: Record<string, unknown> = { status: res.status, updated_at: nowIso };
      if (res.status === "out" && res.endedAt) patch.ended_at = res.endedAt;

      // Re-assert status = 'active' in the filter so a concurrent change wins
      // rather than being clobbered.
      const { error: upErr } = await db
        .from("wildfires")
        .update(patch)
        .eq("id", fire.id)
        .eq("status", "active");
      if (upErr) continue;

      resolved++;
      logs.push({
        fire_id: fire.id,
        posted_at: nowIso,
        title: `Status changed to ${res.status === "out" ? "Out" : "Contained"}`,
        content: `Active status cleared automatically: ${res.reason}.`,
        category: "containment",
      });
    }

    if (logs.length > 0) {
      await db.from("fire_updates").insert(logs);
    }

    return json({ ok: true, scanned: fires.length, resolved }, 200);
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
