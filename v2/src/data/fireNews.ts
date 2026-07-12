// Nearby-news lookup for a selected incident. Uses GDELT's DOC 2.0 API, which
// is keyless — no backend, consistent with live mode. We query the incident by
// name (a strong geographic locator for wildfires) restricted to US sources,
// newest first. Parsing is pure and tested; the fetch is best-effort.
//
// We load results via JSONP (a <script> tag) rather than fetch(): the DOC
// endpoint does not reliably send CORS headers for XHR/fetch from the browser,
// which blocks the request. JSONP sidesteps CORS structurally. GDELT wraps the
// JSON in our `callback` (see its JSONP docs).

import type { Fire } from '../domain'

const DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'
const MAX_RECORDS = 8
const TIMESPAN = '7d'
const TIMEOUT_MS = 8000

export interface NewsItem {
  title: string
  url: string
  domain: string
  publishedAt: string | null
}

interface GdeltArticle {
  url?: unknown
  title?: unknown
  domain?: unknown
  seendate?: unknown
}

// Build the GDELT query for a fire. Quote the core place-name and AND the word
// "fire", restricted to US sources, e.g. `"Palisades" fire sourcecountry:US`.
export function gdeltQuery(fire: Fire): string {
  const core = fire.name.replace(/\s+Fire$/i, '').trim()
  const phrase = core.length >= 3 ? core : fire.name
  return `"${phrase}" fire sourcecountry:US`
}

// GDELT seendate is `YYYYMMDDTHHMMSSZ`; convert to ISO 8601, or null if absent.
export function parseSeenDate(v: unknown): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(v ?? ''))
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
}

// Pure: GDELT ArtList payload -> de-duped news items (by URL), newest first.
export function parseGdelt(payload: { articles?: GdeltArticle[] } | null | undefined): NewsItem[] {
  const articles = payload?.articles ?? []
  const seen = new Set<string>()
  const items: NewsItem[] = []
  for (const a of articles) {
    const url = String(a.url ?? '').trim()
    const title = String(a.title ?? '').trim()
    if (!url || !title || seen.has(url)) continue
    seen.add(url)
    items.push({
      title,
      url,
      domain: String(a.domain ?? '').trim() || new URL(url).hostname.replace(/^www\./, ''),
      publishedAt: parseSeenDate(a.seendate),
    })
  }
  items.sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))
  return items.slice(0, MAX_RECORDS)
}

// Build a DOC API URL. Spaces are encoded as %20 (not the `+` URLSearchParams
// emits), which GDELT's query parser requires — `+` is a reserved operator there.
function docUrl(fire: Fire, extra: Record<string, string>): string {
  const params: Record<string, string> = {
    query: gdeltQuery(fire),
    mode: 'ArtList',
    timespan: TIMESPAN,
    sort: 'DateDesc',
    ...extra,
  }
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${DOC_URL}?${qs}`
}

// A direct link to the same GDELT search a human can open (HTML view).
export function gdeltSearchUrl(fire: Fire): string {
  return docUrl(fire, {})
}

// Load a JSONP URL by injecting a <script>; resolves with the payload GDELT
// passes to our callback. Rejects on network error or timeout. Cleans up the
// script tag and global callback in all cases.
function loadJsonp(baseUrl: string, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('no DOM')); return }
    const cb = `__gdelt_cb_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
    const win = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    let settled = false
    const cleanup = () => {
      settled = true
      delete win[cb]
      script.remove()
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => { if (!settled) { cleanup(); reject(new Error('aborted')) } }
    const timer = setTimeout(() => { if (!settled) { cleanup(); reject(new Error('GDELT timeout')) } }, TIMEOUT_MS)
    win[cb] = (data: unknown) => { if (!settled) { cleanup(); resolve(data) } }
    script.onerror = () => { if (!settled) { cleanup(); reject(new Error('GDELT load error')) } }
    signal?.addEventListener('abort', onAbort)
    script.src = `${baseUrl}&format=jsonp&callback=${cb}`
    document.head.appendChild(script)
  })
}

export async function fetchFireNews(fire: Fire, signal?: AbortSignal): Promise<NewsItem[]> {
  const payload = await loadJsonp(docUrl(fire, { maxrecords: String(MAX_RECORDS) }), signal)
  return parseGdelt(payload as { articles?: GdeltArticle[] } | null)
}
