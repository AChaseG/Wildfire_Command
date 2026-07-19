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

// Broadcastify's state listen pages use ?stid=<FIPS state code>. We can't derive
// their internal county IDs without their catalog API, so we link to the state
// page where the user picks the county's Fire Dispatch feed.
const STATE_FIPS: Record<string, number> = {
  AL: 1, AK: 2, AZ: 4, AR: 5, CA: 6, CO: 8, CT: 9, DE: 10, DC: 11, FL: 12, GA: 13,
  HI: 15, ID: 16, IL: 17, IN: 18, IA: 19, KS: 20, KY: 21, LA: 22, ME: 23, MD: 24,
  MA: 25, MI: 26, MN: 27, MS: 28, MO: 29, MT: 30, NE: 31, NV: 32, NH: 33, NJ: 34,
  NM: 35, NY: 36, NC: 37, ND: 38, OH: 39, OK: 40, OR: 41, PA: 42, RI: 44, SC: 45,
  SD: 46, TN: 47, TX: 48, UT: 49, VT: 50, VA: 51, WA: 53, WV: 54, WI: 55, WY: 56,
}

// Pull the 2-letter state code from a "County, ST" location description.
function stateCode(description: string | null): string | null {
  if (!description) return null
  const last = description.split(',').pop()?.trim().toUpperCase()
  return last && last in STATE_FIPS ? last : null
}

// A Broadcastify listen link for the incident's state (fire dispatch scanner
// feeds), or the national listen page when the state is unknown. Just a link —
// no scraping or redistribution, per Broadcastify's terms.
export function broadcastifyListenUrl(description: string | null): string {
  const st = stateCode(description)
  return st ? `https://www.broadcastify.com/listen/?stid=${STATE_FIPS[st]}` : 'https://www.broadcastify.com/listen/'
}

// A direct link to this exact incident's raw record in the WFIGS feature
// service (rendered as a readable HTML table), keyed by its IrwinID. Falls back
// to the NIFC open-data portal when the id is missing.
function wfigsRecordUrl(externalId: string | null): string {
  if (!externalId) return 'https://data-nifc.opendata.arcgis.com/'
  const where = encodeURIComponent(`IrwinID='${externalId}'`)
  return `${WFIGS_LAYER}?where=${where}&outFields=*&returnGeometry=true&outSR=4326&f=html`
}

export interface SourceOptions {
  // AQI comes from Open-Meteo's Air Quality API in browser (live) mode, but from
  // PurpleAir sensors when the Supabase backend enriches it.
  aqiFromBackend?: boolean
}

export function fireSources(fire: Fire, opts: SourceOptions = {}): FireSource[] {
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
    // Browser-direct (live) AQI comes from Open-Meteo's Air Quality API; the
    // optional backend instead sources it from PurpleAir sensors.
    sources.push(opts.aqiFromBackend
      ? {
          name: 'PurpleAir',
          contributes: 'Air quality (AQI)',
          url: `https://map.purpleair.com/?zoom=11&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
          kind: 'data',
        }
      : {
          name: 'Open-Meteo Air Quality',
          contributes: 'Air quality (US AQI)',
          url: `https://open-meteo.com/en/docs/air-quality-api?${at}`,
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

  // Broadcastify: listen to the area's live fire/police scanner feeds.
  sources.push({
    name: 'Broadcastify scanner',
    contributes: 'Live fire/police radio scanner feeds for the area',
    url: broadcastifyListenUrl(fire.location.description),
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
