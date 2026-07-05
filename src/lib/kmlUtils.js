// Minimal KML parser: turns raw KML XML into an array of drawable features.
// Supports Point, LineString, Polygon (outer boundary), and MultiGeometry.
// Coordinates in KML are "lng,lat[,alt]" tuples; Leaflet wants [lat, lng].

function parseCoordString(text) {
  if (!text) return []
  return text
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const [lng, lat] = tuple.split(',').map(Number)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null
      return [lat, lng]
    })
    .filter(Boolean)
}

function textOf(el, tag) {
  const node = el.getElementsByTagName(tag)[0]
  return node ? node.textContent.trim() : ''
}

function geometriesFrom(el) {
  const out = []

  for (const pt of el.getElementsByTagName('Point')) {
    const coords = parseCoordString(textOf(pt, 'coordinates'))
    if (coords.length) out.push({ type: 'point', latlng: coords[0] })
  }

  for (const line of el.getElementsByTagName('LineString')) {
    const coords = parseCoordString(textOf(line, 'coordinates'))
    if (coords.length >= 2) out.push({ type: 'line', coords })
  }

  for (const poly of el.getElementsByTagName('Polygon')) {
    const outer = poly.getElementsByTagName('outerBoundaryIs')[0] || poly
    const coords = parseCoordString(textOf(outer, 'coordinates'))
    if (coords.length >= 3) out.push({ type: 'polygon', coords })
  }

  return out
}

// Returns { features: [{ name, geometries: [...] }], error } — never throws.
export function parseKml(kmlText) {
  if (!kmlText || typeof kmlText !== 'string') {
    return { features: [], error: 'Empty KML content' }
  }
  let doc
  try {
    doc = new DOMParser().parseFromString(kmlText, 'application/xml')
  } catch {
    return { features: [], error: 'Could not parse KML file' }
  }
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { features: [], error: 'Invalid KML/XML' }
  }

  const placemarks = doc.getElementsByTagName('Placemark')
  const features = []
  for (const pm of placemarks) {
    const geometries = geometriesFrom(pm)
    if (geometries.length === 0) continue
    features.push({ name: textOf(pm, 'name') || 'Unnamed feature', geometries })
  }

  // Some KML exports place geometry directly under a Document/Folder with no
  // Placemark wrapper — fall back to a document-wide sweep in that case.
  if (features.length === 0) {
    const geometries = geometriesFrom(doc.documentElement)
    if (geometries.length) features.push({ name: 'KML features', geometries })
  }

  if (features.length === 0) {
    return { features: [], error: 'No supported geometry found in KML' }
  }
  return { features, error: null }
}

export function countGeometries(features) {
  return features.reduce((n, f) => n + f.geometries.length, 0)
}
