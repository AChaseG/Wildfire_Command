export const SEVERITY_LEVELS = ['low', 'moderate', 'high', 'extreme']

export const SEVERITY_META = {
  low: { label: 'Low', color: '#3fb950', glow: 'rgba(63, 185, 80, 0.5)', rank: 0 },
  moderate: { label: 'Moderate', color: '#f0a020', glow: 'rgba(240, 160, 32, 0.5)', rank: 1 },
  high: { label: 'High', color: '#f85149', glow: 'rgba(248, 81, 73, 0.5)', rank: 2 },
  extreme: { label: 'Extreme', color: '#a01a1a', glow: 'rgba(160, 26, 26, 0.6)', rank: 3 },
}

export const STATUS_META = {
  active: { label: 'Active', color: '#f85149' },
  contained: { label: 'Contained', color: '#f0a020' },
  controlled: { label: 'Controlled', color: '#3fb950' },
  out: { label: 'Out', color: '#6b7280' },
}

export function aqiCategory(aqi) {
  if (aqi == null) return { label: 'Unknown', color: '#6b7280' }
  if (aqi <= 50) return { label: 'Good', color: '#3fb950' }
  if (aqi <= 100) return { label: 'Moderate', color: '#f0a020' }
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#f97316' }
  if (aqi <= 200) return { label: 'Unhealthy', color: '#f85149' }
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#a01a1a' }
  return { label: 'Hazardous', color: '#7e0023' }
}

export function formatAcreage(acres) {
  if (acres == null) return '—'
  return acres.toLocaleString('en-US') + ' ac'
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelative(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function fireDuration(startedAt, endedAt) {
  if (!startedAt) return '—'
  const end = endedAt ? new Date(endedAt) : new Date()
  const start = new Date(startedAt)
  const diffMs = end - start
  if (diffMs < 0) return '—'
  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

export const CATEGORY_META = {
  containment: { label: 'Containment', icon: 'circle-half' },
  evacuation: { label: 'Evacuation', icon: 'alert' },
  weather: { label: 'Weather', icon: 'wind' },
  air_quality: { label: 'Air Quality', icon: 'cloud' },
  crews: { label: 'Crews', icon: 'people' },
  general: { label: 'General', icon: 'info' },
}

export function filterFires(fires, filter, from, to) {
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null
  return fires.filter((f) => {
    if (filter === 'extreme' && f.severity !== 'extreme') return false
    if (filter === 'active' && f.status !== 'active') return false
    if (filter === 'contained' && f.status !== 'contained' && f.status !== 'controlled') return false
    if (filter === 'historical' && f.status !== 'out') return false
    if (fromMs != null || toMs != null) {
      const started = f.started_at ? new Date(f.started_at).getTime() : null
      if (started == null) return false
      if (fromMs != null && started < fromMs) return false
      if (toMs != null && started > toMs) return false
    }
    return true
  })
}
