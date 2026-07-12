// Nearby-news lookup for a selected incident. Uses GDELT's DOC 2.0 API, which
// is keyless and sends `Access-Control-Allow-Origin: *`, so it works straight
// from the browser — no backend, consistent with live mode. We query the
// incident by name (a strong geographic locator for wildfires) restricted to US
// sources, newest first. Parsing is pure and tested; the fetch is best-effort.

import type { Fire } from '../domain'

const DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'
const MAX_RECORDS = 8
const TIMESPAN = '7d'

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

// A direct link to the same GDELT search a human can open.
export function gdeltSearchUrl(fire: Fire): string {
  const params = new URLSearchParams({ query: gdeltQuery(fire), mode: 'ArtList', timespan: TIMESPAN, sort: 'DateDesc' })
  return `${DOC_URL}?${params}`
}

export async function fetchFireNews(fire: Fire, signal?: AbortSignal): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    query: gdeltQuery(fire),
    mode: 'ArtList',
    format: 'json',
    maxrecords: String(MAX_RECORDS),
    timespan: TIMESPAN,
    sort: 'DateDesc',
  })
  const res = await fetch(`${DOC_URL}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`GDELT ${res.status}`)
  // GDELT occasionally returns an HTML error page with a 200; guard the parse.
  const text = await res.text()
  let payload: { articles?: GdeltArticle[] }
  try {
    payload = JSON.parse(text)
  } catch {
    return []
  }
  return parseGdelt(payload)
}
