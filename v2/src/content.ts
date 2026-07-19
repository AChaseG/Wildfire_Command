// Static help/marketing content surfaced in Settings.

export const APP_VERSION = '2.3.0'
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
  { q: 'Where does the data come from?', a: 'Active incidents come from the NIFC WFIGS interagency feed, fetched live in your browser. Wind and US air-quality (AQI) are enriched per incident from Open-Meteo’s keyless APIs — also right in the browser, no backend needed. The optional backend adds NASA FIRMS hotspots and a continuous server-side update history.' },
  { q: 'What decides which incidents the list shows?', a: 'By default the Incidents list shows whatever fires are in the current map view — pan or zoom to change it. Selecting a saved place (“Show fires within…”) instead filters the list to fires inside that place’s alert radius and frames the map to it. Clear the chip to return to the map view.' },
  { q: 'What do the Alerts show?', a: 'Only the fires that matter to you: those within a saved place’s alert radius, and any of extreme severity (plus hazardous-air warnings for those). With no saved places, it’s just the extreme fires.' },
  { q: 'Does the Updates tab show history without a backend?', a: 'Yes. As you use the app it records the changes it observes — containment climbing, size growing, status changes — into a per-incident log in your browser that builds up over time, and it derives a timeline from the incident’s own dated fields. The optional backend adds a continuous, shared change log.' },
  { q: 'How is a fire’s cause classified (arson vs accident)?', a: 'From the official NWCG cause on the incident: arson (“Incendiary”), accidental human causes (debris burning, equipment, campfire, smoking, powerline, railroad, fireworks…), natural (lightning), or undetermined while it’s under investigation. The app classifies the data — it doesn’t infer a cause on its own.' },
  { q: 'Where does “Nearby news” come from?', a: 'Recent US news matched to the incident by name via GDELT (a free, keyless news index). Headlines open on the publisher’s site. It’s best-effort and name-based, so double-check relevance for generically-named fires.' },
  { q: 'What are the Sources links on an incident?', a: 'They point to the records behind the data: the incident’s own WFIGS record (deep-linked by IrwinID), Open-Meteo for wind/AQI, plus authoritative references to cross-check it — WildCAD/WildWeb dispatch logs, Broadcastify live scanner feeds for the area, InciWeb, and a NASA FIRMS map centered on the fire.' },
  { q: 'Why are fires shown as flames?', a: 'Each incident is a small flame icon colored by severity (green → red), sized to its severity, over a glow that brightens for the selected fire. Hover any flame for a quick card with the name, start date, and containment.' },
  { q: 'Are my saved places private?', a: 'Yes. Saved places, preferences, and settings live only in your browser (localStorage). Nothing is uploaded, and there are no accounts.' },
  { q: 'Why don’t alerts fire when the app is closed?', a: 'Browser notifications only work while a tab is open. Truly external alerts (email/SMS/push when the app is closed) require a backend and a push service.' },
  { q: 'What are FIRMS hotspots?', a: 'Satellite thermal detections from NASA FIRMS — points where sensors detected heat. They render as a heatmap and are a leading signal, not confirmed incidents. They need the optional backend.' },
  { q: 'How is a fire marked contained or out?', a: 'From the incident’s own data: 100% containment or a containment date → contained; an out/control date → out. Otherwise it stays active.' },
  { q: 'Can I hide fires that have gone quiet?', a: 'Yes — Settings → General → “Drop off inactive fires.” Pick a window (e.g. 3 or 7 days) and any active fire whose record hasn’t updated within it is hidden, since there’s no fresh confirmation it’s still burning. It’s off by default, never hides contained/out fires, and a hidden fire reappears the moment it updates again. The top bar shows how many are hidden.' },
  { q: 'Can I add live scanner radio?', a: 'Optionally. If you run your own broadcastify-transcriber instance (a Python/ffmpeg/Whisper service that transcribes Broadcastify feeds), paste its URL in Settings → Integrations to get a Scanner tab of live transcribed fire/police radio, filtered to wildfire-related chatter. You host it yourself; it must be reachable over HTTPS with CORS enabled for this site. Nothing is enabled by default.' },
  { q: 'Do the alert radius and distances use my chosen units?', a: 'Yes. Everything follows the mi/km setting in Settings → General.' },
]

// `date` is an ISO `YYYY-MM-DD` day. The What's-new view groups entries by that
// day into dated sections, so multiple releases on the same day share a header.
export interface ChangelogEntry { version: string; date: string; items: string[] }

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.3.0',
    date: '2026-07-14',
    items: [
      'Optional Scanner tab: connect your own broadcastify-transcriber instance (Settings → Integrations) to see live, transcribed fire/police radio filtered to wildfire chatter.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-07-14',
    items: [
      'New “drop off inactive fires” setting: hide active fires with no update within a window you choose (off by default).',
      'Added a Broadcastify link to each incident for listening to local fire/police scanner feeds.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-07-12',
    items: [
      'Wind and US air quality (AQI) now populate live in the browser via Open-Meteo — no backend required.',
      'Fires now appear as severity-colored flame icons; hover one for a quick name / start-date / containment card.',
      'Cause now distinguishes arson from accidental human causes, using the official NWCG cause.',
      'Updates tab builds real history with no backend — recording observed changes over time plus a snapshot timeline.',
      'New “Nearby news” for a selected incident (via GDELT), and a “Sources” section linking every data record (WFIGS, Open-Meteo) and references (WildCAD/WildWeb, InciWeb, NASA FIRMS).',
      'Incident list follows the map view; selecting a saved place filters it to that place’s alert radius.',
      'Alerts now focus on fires near your saved places or of extreme severity.',
    ],
  },
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
