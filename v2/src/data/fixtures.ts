import type { Fire, FireUpdate } from '../domain'

// Demo data used when no Supabase project is configured (VITE_SUPABASE_URL
// empty), so the UI is fully explorable without a backend. With env set, the
// data layer reads real rows instead.
export const SAMPLE_FIRES: Fire[] = [
  {
    id: 'f1', source: 'NIFC WFIGS', externalId: 'demo-1', name: 'Palisades Fire',
    cause: 'Under investigation', severity: 'extreme', status: 'active',
    containmentPct: 27, acres: 23_448, discoveredAt: '2026-07-02T14:00:00Z', endedAt: null,
    location: { lat: 34.05, lng: -118.53, description: 'Los Angeles County, CA' },
    weather: { windSpeedMph: 22, windDirectionDeg: 45, aqi: 168 },
    summary: 'Fast-moving fire in the Santa Monica foothills driven by offshore winds.',
    monitored: true, updatedAt: '2026-07-08T12:00:00Z',
  },
  {
    id: 'f2', source: 'NIFC WFIGS', externalId: 'demo-2', name: 'Bear Complex',
    cause: 'Lightning', severity: 'high', status: 'active',
    containmentPct: 61, acres: 14_200, discoveredAt: '2026-06-20T09:00:00Z', endedAt: null,
    location: { lat: 40.1, lng: -121.2, description: 'Plumas County, CA' },
    weather: { windSpeedMph: 6, windDirectionDeg: 200, aqi: 84 },
    summary: 'Lightning complex burning in steep terrain of the Plumas National Forest.',
    monitored: false, updatedAt: '2026-07-08T12:00:00Z',
  },
  {
    id: 'f3', source: 'NIFC WFIGS', externalId: 'demo-3', name: 'Rattlesnake Fire',
    cause: 'Arson/Incendiary', severity: 'high', status: 'active',
    containmentPct: 12, acres: 11_030, discoveredAt: '2026-07-05T18:30:00Z', endedAt: null,
    location: { lat: 44.06, lng: -121.31, description: 'Deschutes County, OR' },
    weather: { windSpeedMph: 15, windDirectionDeg: 300, aqi: 132 },
    summary: 'Growing rapidly east of Bend amid dry fuels and gusty afternoon winds.',
    monitored: true, updatedAt: '2026-07-08T11:00:00Z',
  },
  {
    id: 'f4', source: 'NIFC WFIGS', externalId: 'demo-4', name: 'Coyote Ridge Fire',
    cause: 'Powerline', severity: 'moderate', status: 'active',
    containmentPct: 74, acres: 3_920, discoveredAt: '2026-06-28T12:00:00Z', endedAt: null,
    location: { lat: 39.53, lng: -119.81, description: 'Washoe County, NV' },
    weather: { windSpeedMph: 9, windDirectionDeg: 250, aqi: 61 },
    summary: 'Nearing containment north of Reno; crews mopping up the eastern flank.',
    monitored: false, updatedAt: '2026-07-08T10:00:00Z',
  },
  {
    id: 'f5', source: 'NIFC WFIGS', externalId: 'demo-5', name: 'Granite Peak Fire',
    cause: 'Lightning', severity: 'extreme', status: 'active',
    containmentPct: 5, acres: 58_600, discoveredAt: '2026-07-06T22:00:00Z', endedAt: null,
    location: { lat: 45.9, lng: -113.9, description: 'Beaverhead County, MT' },
    weather: { windSpeedMph: 18, windDirectionDeg: 210, aqi: 205 },
    summary: 'Explosive growth overnight in remote wilderness; evacuations underway.',
    monitored: true, updatedAt: '2026-07-08T12:30:00Z',
  },
  {
    id: 'f6', source: 'NIFC WFIGS', externalId: 'demo-6', name: 'Mesa Verde Fire',
    cause: 'Human', severity: 'moderate', status: 'contained',
    containmentPct: 100, acres: 2_140, discoveredAt: '2026-06-15T15:00:00Z', endedAt: null,
    location: { lat: 37.23, lng: -108.46, description: 'Montezuma County, CO' },
    weather: { windSpeedMph: 4, windDirectionDeg: 180, aqi: 44 },
    summary: 'Fully contained; crews monitoring interior for residual heat.',
    monitored: false, updatedAt: '2026-07-07T18:00:00Z',
  },
  {
    id: 'f7', source: 'NIFC WFIGS', externalId: 'demo-7', name: 'Salt Flat Fire',
    cause: 'Lightning', severity: 'low', status: 'controlled',
    containmentPct: 100, acres: 640, discoveredAt: '2026-06-10T11:00:00Z', endedAt: null,
    location: { lat: 40.77, lng: -113.9, description: 'Tooele County, UT' },
    weather: { windSpeedMph: 7, windDirectionDeg: 160, aqi: 38 },
    summary: 'Controlled; no further growth expected.',
    monitored: false, updatedAt: '2026-07-05T09:00:00Z',
  },
  {
    id: 'f8', source: 'NIFC WFIGS', externalId: 'demo-8', name: 'Ponderosa Fire',
    cause: 'Campfire', severity: 'high', status: 'out',
    containmentPct: 100, acres: 9_800, discoveredAt: '2026-05-28T08:00:00Z', endedAt: '2026-06-22T00:00:00Z',
    location: { lat: 34.2, lng: -111.65, description: 'Gila County, AZ' },
    weather: { windSpeedMph: 3, windDirectionDeg: 90, aqi: 41 },
    summary: 'Declared out after three weeks; area reopened to the public.',
    monitored: false, updatedAt: '2026-06-22T00:00:00Z',
  },
]

export const SAMPLE_UPDATES: Record<string, FireUpdate[]> = {
  f1: [
    { id: 'u1', fireId: 'f1', postedAt: '2026-07-08T12:00:00Z', kind: 'evacuation', title: 'Mandatory evacuations expanded', body: 'Zones LA-14 through LA-19 are now under mandatory evacuation orders.' },
    { id: 'u2', fireId: 'f1', postedAt: '2026-07-08T06:00:00Z', kind: 'containment', title: 'Containment increased to 27%', body: 'Overnight humidity recovery let crews strengthen the southern line.' },
    { id: 'u3', fireId: 'f1', postedAt: '2026-07-07T20:00:00Z', kind: 'weather', title: 'Red flag warning through Thursday', body: 'Offshore winds gusting 35–45 mph expected to challenge containment lines.' },
  ],
  f5: [
    { id: 'u4', fireId: 'f5', postedAt: '2026-07-08T12:30:00Z', kind: 'general', title: 'Fire grew to 58,600 acres', body: 'Burned area increased by roughly 40,000 acres in 12 hours.' },
    { id: 'u5', fireId: 'f5', postedAt: '2026-07-08T04:00:00Z', kind: 'crews', title: 'Two hotshot crews assigned', body: 'Additional resources ordered as the incident moves to Type 1 management.' },
  ],
  f3: [
    { id: 'u6', fireId: 'f3', postedAt: '2026-07-08T11:00:00Z', kind: 'air_quality', title: 'Air quality unhealthy in Bend', body: 'AQI reached 132; sensitive groups advised to limit outdoor activity.' },
  ],
}
