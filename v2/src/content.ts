// Static help/marketing content surfaced in Settings.

export const APP_VERSION = '2.0.1'
export const REPO_URL = 'https://github.com/AChaseG/Wildfire_Command'

export interface TutorialStep { title: string; body: string }

export const TUTORIAL: TutorialStep[] = [
  { title: 'Browse incidents', body: 'The left panel lists active wildfires. Search by name or place, and filter by status (Active, Contained, Out).' },
  { title: 'Inspect a fire', body: 'Select an incident to open its detail panel — size, severity, cause, wind, air quality, recent updates, and how far it is from each of your saved places.' },
  { title: 'Read the map', body: 'Fires are colored by severity (green → red). Toggle FIRMS satellite hotspots, switch basemaps (Dark, Light, Streets, Satellite), and zoom/pan freely.' },
  { title: 'Measure distance', body: 'Turn on Measure and click points on the map to sum the great-circle distance between them.' },
  { title: 'Save places & get alerts', body: 'On the Places tab, add a location by address or by dropping a pin, give it a name and star color, and set an alert radius. Enable alerts to get a browser notification when a fire enters that radius.' },
  { title: 'Make it yours', body: 'Use Settings to switch light/dark theme and mi/km units, and to set the alert sound volume.' },
]

export interface FaqItem { q: string; a: string }

export const FAQ: FaqItem[] = [
  { q: 'Where does the data come from?', a: 'Active incidents come from the NIFC WFIGS interagency feed, fetched live in your browser. With the optional backend enabled, the app also ingests NASA FIRMS hotspots, Open-Meteo wind, and PurpleAir air quality.' },
  { q: 'Are my saved places private?', a: 'Yes. Saved places, preferences, and settings live only in your browser (localStorage). Nothing is uploaded, and there are no accounts.' },
  { q: 'Why don’t alerts fire when the app is closed?', a: 'Browser notifications only work while a tab is open. Truly external alerts (email/SMS/push when the app is closed) require a backend and a push service.' },
  { q: 'What are FIRMS hotspots?', a: 'Satellite thermal detections from NASA FIRMS — points where sensors detected heat. They render as a heatmap and are a leading signal, not confirmed incidents.' },
  { q: 'How is a fire marked contained or out?', a: 'From the incident’s own data: 100% containment or a containment date → contained; an out/control date → out. Otherwise it stays active.' },
  { q: 'Do the alert radius and distances use my chosen units?', a: 'Yes. Everything follows the mi/km setting in Settings → General.' },
]

// `date` is an ISO `YYYY-MM-DD` day. The What's-new view groups entries by that
// day into dated sections, so multiple releases on the same day share a header.
export interface ChangelogEntry { version: string; date: string; items: string[] }

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.1',
    date: '2026-07-12',
    items: [
      'What’s-new opens automatically after an update; the FAQ greets first-time users.',
      'Saved places now use a color star marker you choose, with a per-place alert radius.',
      'Incident detail lists the distance from each of your saved places.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-06-01',
    items: [
      'Ground-up rebuild on Vite + TypeScript + MapLibre GL with a tested domain core.',
      'Backend-less “live” mode: real incidents fetched directly from NIFC WFIGS — deployable as a static site.',
      'Basemap picker: Dark, Light, Streets, Satellite.',
      'Saved places with proximity browser notifications.',
      'Measure tool, FIRMS hotspot heatmap, alerts feed, light/dark theme, mi/km units.',
    ],
  },
]

/** Format an ISO `YYYY-MM-DD` day for a changelog section header. */
export function formatChangelogDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Group changelog entries by their date, preserving newest-first order. */
export function groupChangelogByDate(entries: ChangelogEntry[]): { date: string; entries: ChangelogEntry[] }[] {
  const groups: { date: string; entries: ChangelogEntry[] }[] = []
  for (const entry of entries) {
    const existing = groups.find((g) => g.date === entry.date)
    if (existing) existing.entries.push(entry)
    else groups.push({ date: entry.date, entries: [entry] })
  }
  return groups
}

export interface DataSource { name: string; url: string; note: string }

export const DATA_SOURCES: DataSource[] = [
  { name: 'NIFC WFIGS', url: 'https://data-nifc.opendata.arcgis.com/', note: 'Active wildfire incidents' },
  { name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', note: 'Satellite thermal hotspots' },
  { name: 'Open-Meteo', url: 'https://open-meteo.com/', note: 'Wind conditions' },
  { name: 'PurpleAir', url: 'https://www2.purpleair.com/', note: 'Air quality (AQI)' },
  { name: 'CARTO basemaps', url: 'https://carto.com/basemaps/', note: 'Dark / Light / Streets styles' },
  { name: 'Esri World Imagery', url: 'https://www.esri.com/', note: 'Satellite basemap' },
  { name: 'OpenStreetMap Nominatim', url: 'https://nominatim.openstreetmap.org/', note: 'Address geocoding' },
]
