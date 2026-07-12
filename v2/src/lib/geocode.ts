export interface GeocodeResult {
  lat: number
  lng: number
  label: string
}

// Free, keyless address lookup via OpenStreetMap Nominatim (CORS-enabled).
// Please keep request volume low per their usage policy.
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
  const hit = Array.isArray(data) ? data[0] : undefined
  if (!hit) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, label: hit.display_name ?? query }
}

// Trim a verbose "123 Main St, City, County, State, ZIP, Country" label to
// something short enough for a place name.
export function shortLabel(label: string): string {
  return label.split(',').slice(0, 2).join(',').trim()
}
