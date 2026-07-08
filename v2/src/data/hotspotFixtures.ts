import type { Hotspot } from '../domain'

// Demo hotspots clustered around the sample incidents so the heatmap layer has
// something to render offline. Generated deterministically from a few centers.
const CENTERS: { lat: number; lng: number; n: number }[] = [
  { lat: 34.05, lng: -118.53, n: 40 }, // Palisades
  { lat: 40.1, lng: -121.2, n: 24 }, // Bear Complex
  { lat: 44.06, lng: -121.31, n: 20 }, // Rattlesnake
  { lat: 45.9, lng: -113.9, n: 50 }, // Granite Peak
]

function build(): Hotspot[] {
  const out: Hotspot[] = []
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (const c of CENTERS) {
    for (let i = 0; i < c.n; i++) {
      const spread = 0.35
      out.push({
        id: `h-${c.lat}-${i}`,
        lat: c.lat + (rand() - 0.5) * spread,
        lng: c.lng + (rand() - 0.5) * spread,
        brightnessK: 300 + rand() * 60,
        frp: Math.round(rand() * 40 * 10) / 10,
        confidence: rand() > 0.5 ? 'h' : 'n',
        detectedAt: '2026-07-08T09:00:00Z',
        satellite: 'N',
      })
    }
  }
  return out
}

export const SAMPLE_HOTSPOTS: Hotspot[] = build()
