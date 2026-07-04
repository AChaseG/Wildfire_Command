const SEVERITY_RANK = { low: 0, moderate: 1, high: 2, extreme: 3 }

export function haversine(a, b) {
  const R = 6378137
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function pointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false
  const { lat, lng } = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function fireInGeoFilter(fire, rule) {
  if (!rule.geo_type) return true
  const point = { lat: fire.latitude, lng: fire.longitude }
  if (rule.geo_type === 'polygon') {
    return pointInPolygon(point, rule.geo_polygon || [])
  }
  if (rule.geo_type === 'radius') {
    if (rule.geo_center_lat == null || rule.geo_center_lng == null) return true
    const center = { lat: rule.geo_center_lat, lng: rule.geo_center_lng }
    const dist = haversine(point, center)
    return dist <= (rule.geo_radius_m || 0)
  }
  return true
}

export function fireMatchesRule(fire, rule) {
  if (!fireInGeoFilter(fire, rule)) return false
  if (rule.severity_min) {
    if ((SEVERITY_RANK[fire.severity] ?? 0) < (SEVERITY_RANK[rule.severity_min] ?? 0))
      return false
  }
  if (rule.aqi_min != null && fire.air_quality != null) {
    if (fire.air_quality < rule.aqi_min) return false
  }
  if (rule.containment_max != null) {
    if (fire.containment_pct > rule.containment_max) return false
  }
  if (rule.status && fire.status !== rule.status) return false
  if (rule.keyword) {
    const kw = rule.keyword.toLowerCase()
    const haystack = `${fire.name} ${fire.summary || ''} ${fire.location_description || ''}`.toLowerCase()
    if (!haystack.includes(kw)) return false
  }
  return true
}

export function buildAlertFromRule(fire, rule) {
  const summaries = []
  if (rule.geo_type === 'polygon') {
    summaries.push('Fire location falls within the defined alert polygon area.')
  } else if (rule.geo_type === 'radius') {
    const distKm = rule.geo_radius_m ? (rule.geo_radius_m / 1000).toFixed(1) : '?'
    summaries.push(`Fire is within ${distKm} km of the monitored location.`)
  }
  if (rule.severity_min) {
    summaries.push(`Fire severity is ${fire.severity} (≥ ${rule.severity_min}).`)
  }
  if (rule.aqi_min != null && fire.air_quality != null) {
    summaries.push(`AQI ${fire.air_quality} exceeds threshold of ${rule.aqi_min}.`)
  }
  if (rule.containment_max != null) {
    summaries.push(`Containment at ${fire.containment_pct}% (≤ ${rule.containment_max}%).`)
  }
  if (rule.status) {
    summaries.push(`Fire status is ${fire.status}.`)
  }
  if (rule.keyword) {
    summaries.push(`Keyword "${rule.keyword}" matched in incident data.`)
  }
  const summaryText = [
    `The ${fire.name} in ${fire.location_description || 'the affected area'} has triggered the "${rule.name}" alert rule.`,
    summaries.join(' '),
    `${fire.acreage_burned?.toLocaleString() || 'Unknown'} acres burned, ${fire.containment_pct}% contained.`,
    `Source: ${rule.category === 'air_quality' ? 'PurpleAir' : 'Wildfire.gov EGP'}.`,
  ].join(' ')

  return {
    severity: rule.alert_severity,
    category: rule.category,
    headline: `${fire.name} — ${rule.alert_severity.toUpperCase()} alert`,
    summary: summaryText,
    source: rule.category === 'air_quality' ? 'PurpleAir' : 'Wildfire.gov',
    source_type: 'native',
    rule_name: rule.name,
    latitude: fire.latitude,
    longitude: fire.longitude,
    generated_at: new Date().toISOString(),
  }
}
