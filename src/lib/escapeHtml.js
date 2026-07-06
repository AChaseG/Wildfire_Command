// Escape a string for safe interpolation into an HTML string. Leaflet's
// bindTooltip/bindPopup render string content as HTML, so any externally-sourced
// text (KML feature names, geocoder labels, data source names) must be escaped
// before it is passed in, or it becomes an XSS vector.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c])
}
