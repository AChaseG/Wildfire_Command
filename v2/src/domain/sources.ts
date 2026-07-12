// Provenance for a selected incident: which upstream feeds produced the data
// shown in the detail panel, each with a direct link to the underlying record.
// Kept pure so it is unit-tested and reused by the UI.

import type { Fire } from './fire'

export interface FireSource {
  /** Human name of the feed, e.g. "NIFC WFIGS". */
  name: string
  /** Which fields in the panel this feed supplies. */
  contributes: string
  /** Direct link to the specific record/view used. */
  url: string
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

  // Core incident record — always present.
  sources.push({
    name: fire.source || 'NIFC WFIGS',
    contributes: 'Location, size, containment, cause, status, and dates',
    url: wfigsRecordUrl(fire.externalId),
  })

  // Enrichment feeds only appear when their value was actually resolved
  // (they need the optional backend; in backend-less "live" mode they are null).
  if (fire.weather.windSpeedMph != null || fire.weather.windDirectionDeg != null) {
    sources.push({
      name: 'Open-Meteo',
      contributes: 'Wind speed and direction',
      url: `https://open-meteo.com/en/docs?${at}`,
    })
  }
  if (fire.weather.aqi != null) {
    sources.push({
      name: 'PurpleAir',
      contributes: 'Air quality (AQI)',
      url: `https://map.purpleair.com/?zoom=11&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`,
    })
  }

  return sources
}
