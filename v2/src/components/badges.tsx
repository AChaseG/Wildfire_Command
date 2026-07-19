import { PRIORITY_META, STATUS_META, type Priority, type FireStatus } from '../domain'

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      className="sev-dot"
      style={{ backgroundColor: PRIORITY_META[priority].color }}
      title={`${PRIORITY_META[priority].label} priority`}
      aria-label={`${PRIORITY_META[priority].label} priority`}
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
