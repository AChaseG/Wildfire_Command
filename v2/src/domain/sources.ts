// Provenance for a selected incident. Two tiers:
//  - 'data' sources actually produced the values shown in the panel, each linked
//    to the specific record used.
//  - 'reference' sources are authoritative places to cross-check the incident,
//    deep-linked by location. (Wildland dispatch data is fragmented across many
//    systems with no single per-incident API keyed by IRWIN, so these link to
//    the relevant portal/map rather than one record.)
// Kept pure so it is unit-tested and reused by the UI.

import type { Fire } from './fire'

export type SourceKind = 'data' | 'reference'

export interface FireSource {
  /** Human name of the feed, e.g. "NIFC WFIGS". */
  name: string
  /** What this source supplies for the incident. */
  contributes: string
  /** Direct link to the specific record/view used. */
  url: string
  kind: SourceKind
}

const WFIGS_LAYER =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query'

// A direct link to this exact incident's raw record in the WFIGS feature
// service (rendered as a readable HTML table), keyed by its IrwinID. Falls back
// to the NIFC open-data portal when the id is missing.
function wfigsRecordUrl(externalId: string | null): string {
  if (!externalId) return 'https://data-nifc.opendata.arcgis.com/'
  const where = encodeURIComponent(`IrwinID='${externalId}'`)
  return `${WFIGS_LAYER}?where=${where}&outFields=*&returnGeometry=true&outSR=4326&f=html`
}

export function fireSources(fire: Fire): FireSource[] {
  const { lat, lng } = fire.location
  const at = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`
  const sources: FireSource[] = []

  // --- Data actually shown in the panel ---

  // Core incident record — always present.
  sources.push({
    name: fire.source || 'NIFC WFIGS',
    contributes: 'Location, size, containment, cause, status, and dates',
    url: wfigsRecordUrl(fire.externalId),
    kind: 'data',
  })

  // Enrichment feeds only appear when their value was actually resolved
  // (they need the optional backend; in backend-less "live" mode they are null).
  if (fire.weather.windSpeedMph != null || fire.weather.windDirectionDeg != null) {
    sources.push({
      name: 'Open-Meteo',
      contributes: 'Wind speed and direction',
      url: `https://open-meteo.com/en/docs?${at}`,
      kind: 'data',
    })
  }
  if (fire.weather.aqi != null) {
    sources.push({
      name: 'PurpleAir',
      contributes: 'Air quality (AQI)',
      url: `https://map.purpleair.com/?zoom=11&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
      kind: 'data',
    })
  }

  // --- Authoritative references to cross-check this incident ---

  // WildCAD / WildWeb: the interagency CAD system dispatch centers run; many
  // WFIGS incidents originate here. No national per-incident API, so link the
  // WildWeb portal of dispatch-center incident logs.
  sources.push({
    name: 'WildCAD · WildWeb',
    contributes: 'Interagency dispatch (CAD) incident logs by center',
    url: 'http://www.wildcad.net/WildCADWeb.asp',
    kind: 'reference',
  })

  // InciWeb: the public interagency incident-information system (narrative
  // updates, evacuation notices, closures, maps).
  sources.push({
    name: 'InciWeb',
    contributes: 'Official incident updates, closures, and maps',
    url: 'https://inciweb.wildfire.gov/accessible-view',
    kind: 'reference',
  })

  // NASA FIRMS: satellite thermal detections, deep-linked to this location.
  sources.push({
    name: 'NASA FIRMS',
    contributes: 'Satellite thermal hotspots near this incident',
    url: `https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${lng.toFixed(4)},${lat.toFixed(4)},9z`,
    kind: 'reference',
  })

  return sources
}
