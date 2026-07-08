import {
  fireDurationMs,
  formatArea,
  formatWind,
  resolveFireStatus,
  type Fire,
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
  onClose: () => void
}

export function IncidentDetail({ fire, onClose }: Props) {
  const { units } = useUnits()
  const { data: updates, isLoading } = useFireUpdates(fire.id)
  const resolution = fire.status === 'active' ? resolveFireStatus(fire) : null

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

      <div className="updates">
        <h3>Updates</h3>
        {isLoading && <p className="list-empty">Loading…</p>}
        {!isLoading && (updates ?? []).length === 0 && <p className="list-empty">No updates yet.</p>}
        <ol className="update-feed">
          {(updates ?? []).map((u) => (
            <li key={u.id} className="update">
              <span className={`update-kind kind-${u.kind}`}>{u.kind.replace('_', ' ')}</span>
              <span className="update-title">{u.title}</span>
              {u.body && <span className="update-body">{u.body}</span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
