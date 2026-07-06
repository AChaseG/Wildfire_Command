// Decides, from the data an incident already carries, whether it should still be
// "active". Looks at the structured containment/end fields first, then falls back
// to the narrative in its recent updates (for sources that only report progress
// as text). Returns the non-active status the fire should take, or null when the
// evidence does not show it fully contained or out.

export type FireStatus = "active" | "contained" | "controlled" | "out";

export interface FireLike {
  containment_pct?: number | null;
  ended_at?: string | null;
  status?: string | null;
}

export interface UpdateLike {
  title?: string | null;
  content?: string | null;
}

export interface Resolution {
  status: "contained" | "out";
  // ISO timestamp to record as the incident's end when it transitions to "out"
  // and no end was previously recorded; null when staying open (contained).
  endedAt: string | null;
  reason: string;
}

// Strong phrases only — never match a bare "out" ("burned out", "out of
// control", "spread out" would all be false positives).
const OUT_RE = /\b(?:declared out|fire\s+is\s+out|is\s+now\s+out|status\s+changed\s+to\s+out)\b/i;
// Full containment worded either way: "100% contained" or "containment … 100%".
// The percentage must be adjacent to containment wording (bounded gap) so plain
// acreage like "100 acres" never matches.
const CONTAINED_RE =
  /\bfully\s+contained\b|\b100\s*(?:%|percent)\s*contain|\bcontain(?:ment|ed)?\b[^.\n]{0,40}?\b100\s*(?:%|percent)/i;

export function resolveFireStatus(
  fire: FireLike,
  updates: UpdateLike[] = [],
  now: Date = new Date(),
): Resolution | null {
  // 1. An explicit end time means the incident is over.
  if (fire.ended_at) {
    return { status: "out", endedAt: fire.ended_at, reason: "end date recorded" };
  }

  const text = updates.map((u) => `${u?.title ?? ""} ${u?.content ?? ""}`).join(" \n ");

  // 2. Narrative that declares the fire out.
  if (OUT_RE.test(text)) {
    return { status: "out", endedAt: now.toISOString(), reason: "an update reports the fire is out" };
  }

  // 3. Full containment — from the structured percentage or the narrative.
  const pct = Number(fire.containment_pct);
  if (Number.isFinite(pct) && pct >= 100) {
    return { status: "contained", endedAt: null, reason: "containment reached 100%" };
  }
  if (CONTAINED_RE.test(text)) {
    return { status: "contained", endedAt: null, reason: "an update reports full containment" };
  }

  return null;
}
