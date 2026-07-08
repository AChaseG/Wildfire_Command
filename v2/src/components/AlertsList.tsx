import type { Alert } from '../domain'

const LEVEL_COLOR: Record<Alert['level'], string> = {
  critical: '#f85149',
  warning: '#f0a020',
  info: '#3fb950',
}

interface Props {
  alerts: Alert[]
  onSelect: (fireId: string) => void
}

export function AlertsList({ alerts, onSelect }: Props) {
  if (alerts.length === 0) {
    return <p className="list-empty">No active alerts.</p>
  }
  return (
    <div className="list-scroll">
      {alerts.map((a) => (
        <button key={a.id} className="alert-row" onClick={() => onSelect(a.fireId)} type="button">
          <span className="alert-bar" style={{ backgroundColor: LEVEL_COLOR[a.level] }} />
          <span className="alert-main">
            <span className="alert-title">{a.title}</span>
            <span className="alert-detail">{a.detail}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
