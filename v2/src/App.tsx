import { useMemo } from 'react'
import {
  SEVERITY_META,
  STATUS_META,
  severityFromAcres,
  resolveFireStatus,
  formatArea,
  formatWind,
  type Fire,
  type UnitSystem,
} from './domain'

// Sample incidents so the foundation renders something real and exercises the
// domain layer in the bundle. Slice 2 replaces these with live data from the
// ingestion pipeline; note Bear Complex is 100%-contained-but-still-active to
// show resolveFireStatus flagging it.
const SAMPLES: Fire[] = [
  {
    id: '1', source: 'NIFC WFIGS', externalId: 'demo-1', name: 'Palisades Fire',
    cause: 'Under investigation', severity: 'extreme', status: 'active',
    containmentPct: 27, acres: 23_448, discoveredAt: '2026-07-02T14:00:00Z', endedAt: null,
    location: { lat: 34.05, lng: -118.53, description: 'Los Angeles County, CA' },
    weather: { windSpeedMph: 22, windDirectionDeg: 45, aqi: 168 },
    summary: null, monitored: true, updatedAt: '2026-07-08T12:00:00Z',
  },
  {
    id: '2', source: 'NIFC WFIGS', externalId: 'demo-2', name: 'Bear Complex',
    cause: 'Lightning', severity: 'high', status: 'active',
    containmentPct: 100, acres: 14_200, discoveredAt: '2026-06-20T09:00:00Z', endedAt: null,
    location: { lat: 40.1, lng: -121.2, description: 'Plumas County, CA' },
    weather: { windSpeedMph: 6, windDirectionDeg: 200, aqi: 54 },
    summary: null, monitored: false, updatedAt: '2026-07-08T12:00:00Z',
  },
]

const UNITS: UnitSystem = 'imperial'

export default function App() {
  const rows = useMemo(
    () =>
      SAMPLES.map((fire) => ({
        fire,
        derivedSeverity: severityFromAcres(fire.acres),
        resolution: resolveFireStatus(fire),
      })),
    [],
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden />
          Wildfire Command <span className="ver">v2</span>
        </div>
        <div className="slice">Slice 1 · foundation — domain layer, schema &amp; CI</div>
      </header>

      <main className="grid">
        {rows.map(({ fire, derivedSeverity, resolution }) => (
          <article
            key={fire.id}
            className="card"
            style={{ borderLeftColor: SEVERITY_META[fire.severity].color }}
          >
            <div className="card-head">
              <h2>{fire.name}</h2>
              <span className="pill" style={{ backgroundColor: STATUS_META[fire.status].color }}>
                {STATUS_META[fire.status].label}
              </span>
            </div>
            <p className="loc">{fire.location.description}</p>

            <dl className="stats">
              <div><dt>Size</dt><dd>{formatArea(fire.acres, UNITS)}</dd></div>
              <div><dt>Containment</dt><dd>{fire.containmentPct}%</dd></div>
              <div><dt>Severity</dt><dd>{SEVERITY_META[fire.severity].label}</dd></div>
              <div><dt>Wind</dt><dd>{formatWind(fire.weather.windSpeedMph, fire.weather.windDirectionDeg, UNITS)}</dd></div>
            </dl>

            <footer className="card-foot">
              <span>derived severity from acreage: <b>{derivedSeverity}</b></span>
              {resolution ? (
                <span className="resolve">
                  → auto-resolves to <b>{resolution.status}</b> ({resolution.reason})
                </span>
              ) : (
                <span className="resolve muted">stays active</span>
              )}
            </footer>
          </article>
        ))}
      </main>

      <footer className="pagefoot">
        Domain functions (severity, status resolution, units) run live above · UI &amp; live data land in slice 2+.
      </footer>
    </div>
  )
}
