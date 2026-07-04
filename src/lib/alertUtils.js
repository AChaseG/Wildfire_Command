export const ALERT_SEVERITY = {
  flash: { label: 'Flash', color: '#ff2e2e', rank: 4, pulse: true },
  urgent: { label: 'Urgent', color: '#f85149', rank: 3, pulse: false },
  high: { label: 'High', color: '#f0a020', rank: 2, pulse: false },
  medium: { label: 'Medium', color: '#58a6ff', rank: 1, pulse: false },
  low: { label: 'Low', color: '#6b7280', rank: 0, pulse: false },
}

export const ALERT_CATEGORY = {
  wildfire: { label: 'Wildfire', icon: 'fire' },
  air_quality: { label: 'Air Quality', icon: 'cloud' },
  evacuation: { label: 'Evacuation', icon: 'alert' },
  weather: { label: 'Weather', icon: 'wind' },
  containment: { label: 'Containment', icon: 'shield' },
  general: { label: 'General', icon: 'info' },
}

export const SEVERITY_FILTERS = [
  { key: 'all', label: 'All severities' },
  { key: 'flash', label: 'Flash' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
]

export const CATEGORY_FILTERS = [
  { key: 'all', label: 'All categories' },
  { key: 'wildfire', label: 'Wildfire' },
  { key: 'air_quality', label: 'Air Quality' },
  { key: 'evacuation', label: 'Evacuation' },
  { key: 'weather', label: 'Weather' },
  { key: 'containment', label: 'Containment' },
]

export function formatAlertTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatAlertStamp(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
