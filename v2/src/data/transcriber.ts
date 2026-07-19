// Optional integration with a self-hosted broadcastify-transcriber instance
// (github.com/Opertum/broadcastify-transcriber): a Python/ffmpeg/Whisper service
// that transcribes Broadcastify scanner feeds and serves them over a FastAPI
// REST API. When the user points the app at their instance, we pull recent
// transmissions and surface the ones that read as wildfire-related.
//
// This needs a backend the user runs; it does not change the default static app.
// The response field names are inferred from the project's README, so the parser
// is deliberately tolerant of variants — adjust `pick` lists if a build differs.

export interface Transmission {
  id: string
  channel: string
  text: string
  timestamp: string | null
  durationSec: number | null
  audioUrl: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function firstDefined(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k]
  return undefined
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

// Wildfire-relevant scanner chatter. Curated wildland terms; a structure/vehicle
// fire is excluded unless it also carries a strong wildland signal.
const WILDFIRE_RE = /\b(wild ?fire|wild ?land|brush\s*fire|brush|vegetation(?:\s*fire)?|grass\s*fire|forest\s*fire|timber|spot\s*fires?|red\s*flag|air\s*tanker|air\s*attack|helitack|hot\s*shot|hand\s*crew|dozer|fire\s*line|containment|contained|smoke\s*(?:showing|column|in the area)|acres?|w\.?u\.?i\.?|fuel\s*(?:bed|moisture|load))\b/i
const NOT_WILDFIRE_RE = /\b(?:structure|vehicle|car|kitchen|chimney|dumpster|trash|appliance|stove|oven)\s*fire\b/i
const STRONG_WILDLAND_RE = /\b(wild ?fire|wild ?land|brush|vegetation|grass\s*fire|spot\s*fires?|timber|forest\s*fire|acres?)\b/i

export function isWildfireRelated(text: string): boolean {
  const t = text.toLowerCase()
  if (!t.trim() || !WILDFIRE_RE.test(t)) return false
  if (NOT_WILDFIRE_RE.test(t) && !STRONG_WILDLAND_RE.test(t)) return false
  return true
}

// Pure: normalize a transcriber payload (array, or {transmissions|results|items})
// into our shape. Rows without text are dropped; newest first when datable.
export function parseTransmissions(data: unknown, baseUrl: string): Transmission[] {
  const root = data as Record<string, unknown> | unknown[] | null
  const arr: unknown[] = Array.isArray(root)
    ? root
    : (Array.isArray((root as Record<string, unknown>)?.transmissions) && (root as Record<string, unknown>).transmissions as unknown[])
      || (Array.isArray((root as Record<string, unknown>)?.results) && (root as Record<string, unknown>).results as unknown[])
      || (Array.isArray((root as Record<string, unknown>)?.items) && (root as Record<string, unknown>).items as unknown[])
      || []

  const base = normalizeBaseUrl(baseUrl)
  const out = arr.map((raw, i): Transmission => {
    const t = (raw ?? {}) as Record<string, unknown>
    const filename = firstDefined(t, ['audio_file', 'filename', 'audio', 'file'])
    const audioUrl = typeof t.audio_url === 'string'
      ? t.audio_url
      : filename != null ? `${base}/audio/${encodeURIComponent(String(filename))}` : null
    const durationRaw = firstDefined(t, ['duration', 'duration_sec', 'length'])
    return {
      id: str(firstDefined(t, ['id', 'uuid', 'transmission_id']) ?? i),
      channel: str(firstDefined(t, ['channel', 'channel_name', 'channelName', 'channel_id']) ?? 'Scanner'),
      text: str(firstDefined(t, ['text', 'transcript', 'transcription'])).trim(),
      timestamp: firstDefined(t, ['timestamp', 'created_at', 'time', 'started_at']) != null
        ? str(firstDefined(t, ['timestamp', 'created_at', 'time', 'started_at']))
        : null,
      durationSec: Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null,
      audioUrl,
    }
  }).filter((t) => t.text.length > 0)

  return out.sort((a, b) => (Date.parse(b.timestamp ?? '') || 0) - (Date.parse(a.timestamp ?? '') || 0))
}

export async function fetchTransmissions(baseUrl: string, limit = 100, signal?: AbortSignal): Promise<Transmission[]> {
  const base = normalizeBaseUrl(baseUrl)
  const res = await fetch(`${base}/api/transmissions?limit=${limit}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Transcriber responded ${res.status}`)
  return parseTransmissions(await res.json(), base)
}
