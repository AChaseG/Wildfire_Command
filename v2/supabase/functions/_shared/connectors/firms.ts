import type { HotspotUpsert } from './types.ts'

// NASA FIRMS active-fire detections (VIIRS), served as CSV from the area API.
// Needs a free MAP_KEY (FIRMS_MAP_KEY). Columns vary between VIIRS/MODIS, so we
// map by header name rather than position.
const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
const PRODUCT = 'VIIRS_SNPP_NRT'

// Pure CSV parser, exported so vitest can exercise the field mapping on fixtures.
export function parseFirmsCsv(csv: string): HotspotUpsert[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0]!.split(',').map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)

  const iLat = col('latitude')
  const iLng = col('longitude')
  const iBright = col('bright_ti4') !== -1 ? col('bright_ti4') : col('brightness')
  const iConf = col('confidence')
  const iFrp = col('frp')
  const iSat = col('satellite')
  const iDate = col('acq_date')
  const iTime = col('acq_time')
  if (iLat === -1 || iLng === -1 || iDate === -1) return []

  const numAt = (cells: string[], i: number): number | null => {
    if (i === -1) return null
    const n = Number(cells[i])
    return Number.isFinite(n) ? n : null
  }

  const rows: HotspotUpsert[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(',')
    const lat = Number(cells[iLat])
    const lng = Number(cells[iLng])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const time = String(cells[iTime] ?? '').padStart(4, '0')
    const detectedAt = `${cells[iDate]}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`

    rows.push({
      source: 'NASA FIRMS',
      latitude: lat,
      longitude: lng,
      brightness_k: numAt(cells, iBright),
      confidence: iConf === -1 ? null : (cells[iConf]?.trim() || null),
      frp: numAt(cells, iFrp),
      detected_at: detectedAt,
      satellite: iSat === -1 ? null : (cells[iSat]?.trim() || null),
    })
  }
  return rows
}

export async function fetchFirmsHotspots(mapKey: string, days = 1): Promise<HotspotUpsert[]> {
  const res = await fetch(`${FIRMS_BASE}/${mapKey}/${PRODUCT}/world/${days}`, {
    headers: { 'User-Agent': 'WildfireCommand/2.0', Accept: 'text/csv' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`FIRMS fetch failed (${res.status}): ${text.slice(0, 200)}`)
  return parseFirmsCsv(text)
}
