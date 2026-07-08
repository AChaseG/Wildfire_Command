import { SEVERITY_META, STATUS_META, type Severity, type FireStatus } from '../domain'

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span
      className="sev-dot"
      style={{ backgroundColor: SEVERITY_META[severity].color }}
      title={`${SEVERITY_META[severity].label} severity`}
      aria-label={`${SEVERITY_META[severity].label} severity`}
    />
  )
}

export function StatusBadge({ status }: { status: FireStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="status-badge" style={{ color: meta.color, borderColor: meta.color }}>
      {meta.label}
    </span>
  )
}
