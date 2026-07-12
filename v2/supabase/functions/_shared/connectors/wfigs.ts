import type { Connector, FireUpsert } from './types.ts'
import { num, pick, severityFromAcres, statusFromWfigs, titleCaseName, type Attrs } from '../normalize.ts'

// NIFC WFIGS "Current Wildland Fire Locations" — the public interagency incident
// feed (ArcGIS Feature Service, no API key). Point geometry in WGS84.
const WFIGS_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query'

const MAX_INCIDENTS = 300
const OUT_FIELDS = [
  'IrwinID', 'IncidentName', 'IncidentTypeCategory',
  'FireDiscoveryDateTime', 'ContainmentDateTime', 'FireOutDateTime', 'ControlDateTime',
  'PercentContained', 'IncidentSize', 'DiscoveryAcres',
  'POOState', 'POOCounty', 'IncidentShortDescription',
  'FireCause', 'FireCauseGeneral', 'FireCauseSpecific',
]

export interface WfigsFeature {
  attributes?: Attrs
  geometry?: { x?: number; y?: number }
}

// Pure parser: ArcGIS features -> upsert rows. Exported so vitest can exercise
// the field mapping on fixtures without any network. Rows missing coordinates or
// the IrwinID (our external_id) are dropped.
export function parseWfigs(features: readonly WfigsFeature[], now: Date = new Date()): FireUpsert[] {
  const nowIso = now.toISOString()
  const rows: FireUpsert[] = []

  for (const f of features) {
    const attr = f.attributes ?? {}
    const lng = num(f.geometry?.x)
    const lat = num(f.geometry?.y)
    const externalId = pick(attr, ['IrwinID'])
    if (lat == null || lng == null || !externalId) continue

    const acres = Math.max(0, Math.round(num(pick(attr, ['IncidentSize', 'DiscoveryAcres'])) ?? 0))
    const containment = Math.min(100, Math.max(0, Math.round(num(pick(attr, ['PercentContained'])) ?? 0)))
    const discovery = num(pick(attr, ['FireDiscoveryDateTime']))
    const rawName = String(pick(attr, ['IncidentName']) ?? 'Unnamed incident').trim()
    const name = `${titleCaseName(rawName)} Fire`.replace(/\s*Fire\s*Fire$/i, ' Fire')
    const state = String(pick(attr, ['POOState']) ?? '').replace(/^US-/, '')
    const county = pick(attr, ['POOCounty'])
    const locParts = [county ? `${county} County` : null, state || null].filter(Boolean)
    // Prefer the NWCG specific cause (e.g. "Arson/Incendiary", "Equipment and
    // Vehicle Use") so the app can tell arson from accidental human causes;
    // fall back to the general cause, then the legacy field.
    const cause = pick(attr, ['FireCauseSpecific', 'FireCauseGeneral', 'FireCause'])
    const shortDesc = pick(attr, ['IncidentShortDescription'])

    const outTime = pick(attr, ['FireOutDateTime', 'ControlDateTime'])

    rows.push({
      source: 'NIFC WFIGS',
      external_id: String(externalId),
      name,
      cause: cause ? String(cause) : null,
      severity: severityFromAcres(acres),
      status: statusFromWfigs(attr, containment),
      containment_pct: containment,
      acres,
      discovered_at: discovery ? new Date(discovery).toISOString() : nowIso,
      ended_at: outTime ? new Date(num(outTime)!).toISOString() : null,
      latitude: lat,
      longitude: lng,
      location_description: locParts.join(', ') || null,
      wind_speed_mph: null,
      wind_direction_deg: null,
      aqi: null,
      summary: [
        `${acres.toLocaleString()} acres, ${containment}% contained.`,
        cause ? `Cause: ${cause}.` : null,
        shortDesc ? String(shortDesc) : null,
      ].filter(Boolean).join(' '),
      updated_at: nowIso,
    })
  }

  return rows
}

export const wfigsConnector: Connector = {
  name: 'wfigs',
  async fetch(): Promise<FireUpsert[]> {
    const params = new URLSearchParams({
      where: "IncidentTypeCategory = 'WF'",
      outFields: OUT_FIELDS.join(','),
      returnGeometry: 'true',
      outSR: '4326',
      orderByFields: 'IncidentSize DESC',
      resultRecordCount: String(MAX_INCIDENTS),
      f: 'json',
    })
    const res = await fetch(`${WFIGS_URL}?${params}`, {
      headers: { 'User-Agent': 'WildfireCommand/2.0', Accept: 'application/json' },
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`WFIGS fetch failed (${res.status}): ${text.slice(0, 200)}`)
    let payload: { features?: WfigsFeature[] }
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error('WFIGS returned a non-JSON response.')
    }
    return parseWfigs(payload.features ?? [])
  },
}
