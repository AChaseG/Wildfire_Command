import { useMemo } from 'react'
import {
  deriveFireTimeline,
  fireDurationMs,
  fireSources,
  formatArea,
  formatDistance,
  formatWind,
  haversineKm,
  resolveFireStatus,
  type Fire,
  type SavedPlace,
} from '../domain'
import { useFireUpdates } from '../data/hooks'
import { useUnits } from '../lib/units'
import { StatusBadge } from './badges'

function durationLabel(fire: Fire): string {
  const ms = fireDurationMs(fire)
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`
}

function updateDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

interface Props {
  fire: Fire
  places: SavedPlace[]
  onClose: () => void
}

export function IncidentDetail({ fire, places, onClose }: Props) {
  const { units } = useUnits()
  const { data: updates, isLoading } = useFireUpdates(fire.id)
  const resolution = fire.status === 'active' ? resolveFireStatus(fire) : null

  const sources = useMemo(() => fireSources(fire), [fire])
  const dataSources = sources.filter((s) => s.kind === 'data')
  const referenceSources = sources.filter((s) => s.kind === 'reference')

  // Prefer the backend's ingested change log; when there is none (e.g.
  // backend-less live mode), derive a timeline from the incident's own dated
  // fields so the tab still shows real history.
  const ingested = updates ?? []
  const derivedTimeline = useMemo(() => deriveFireTimeline(fire, units), [fire, units])
  const feed = ingested.length > 0 ? ingested : derivedTimeline

  const placeDistances = useMemo(
    () =>
      places
        .map((place) => ({ place, km: haversineKm(fire.location, { lat: place.lat, lng: place.lng }) }))
        .sort((a, b) => a.km - b.km),
    [places, fire],
  )

  return (
    <section className="detail">
      <div className="detail-head">
        <div>
          <h2>{fire.name}</h2>
          <p className="detail-loc">{fire.location.description ?? '—'}</p>
        </div>
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Close detail">✕</button>
      </div>

      <div className="detail-badges">
        <StatusBadge status={fire.status} />
        <span className="containment">{fire.containmentPct}% contained</span>
      </div>

      {resolution && (
        <div className="detail-note">
          Data suggests this incident is <b>{resolution.status}</b> ({resolution.reason}).
        </div>
      )}

      <dl className="detail-stats">
        <Stat label="Size" value={formatArea(fire.acres, units)} />
        <Stat label="Severity" value={fire.severity} />
        <Stat label="Cause" value={fire.cause ?? 'Unknown'} />
        <Stat label="Wind" value={formatWind(fire.weather.windSpeedMph, fire.weather.windDirectionDeg, units)} />
        <Stat label="Air quality" value={fire.weather.aqi == null ? '—' : String(fire.weather.aqi)} />
        <Stat label="Duration" value={durationLabel(fire)} />
      </dl>

      {fire.summary && <p className="detail-summary">{fire.summary}</p>}

      {placeDistances.length > 0 && (
        <div className="detail-section">
          <h3>Distance from places</h3>
          <ul className="place-dist">
            {placeDistances.map(({ place, km }) => (
              <li key={place.id}>
                <span className="place-star" style={{ color: place.color }} aria-hidden>★</span>
                <span className="place-dist-name">{place.name}</span>
                <span className={`place-dist-val ${km <= place.alertRadiusKm ? 'in' : ''}`}>
                  {formatDistance(km, units)}
                  {km <= place.alertRadiusKm && <span className="in-tag">in range</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="updates">
        <h3>Updates</h3>
        {isLoading && <p className="list-empty">Loading…</p>}
        {!isLoading && feed.length === 0 && <p className="list-empty">No updates yet.</p>}
        {!isLoading && ingested.length === 0 && derivedTimeline.length > 0 && (
          <p className="updates-note">Timeline derived from the latest WFIGS snapshot. Enable the backend for a full change log.</p>
        )}
        <ol className="update-feed">
          {feed.map((u) => (
            <li key={u.id} className="update">
              <span className="update-meta">
                <span className={`update-kind kind-${u.kind}`}>{u.kind.replace('_', ' ')}</span>
                {updateDate(u.postedAt) && <span className="update-date">{updateDate(u.postedAt)}</span>}
              </span>
              <span className="update-title">{u.title}</span>
              {u.body && <span className="update-body">{u.body}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="detail-section sources-section">
        <h3>Sources</h3>
        <ul className="source-list">
          {dataSources.map((s) => (
            <li key={s.name} className="source-item">
              <a href={s.url} target="_blank" rel="noreferrer" className="source-name">{s.name} ↗</a>
              <span className="source-contributes">{s.contributes}</span>
            </li>
          ))}
        </ul>

        <h4 className="source-subhead">Related sources</h4>
        <ul className="source-list">
          {referenceSources.map((s) => (
            <li key={s.name} className="source-item">
              <a href={s.url} target="_blank" rel="noreferrer" className="source-name">{s.name} ↗</a>
              <span className="source-contributes">{s.contributes}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
