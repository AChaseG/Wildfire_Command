// Satellite thermal detections (NASA FIRMS). Unlike `Fire`, these are ephemeral
// points with no name/containment — thousands per pass — so they live in their
// own table and render as a heatmap layer rather than incident markers.
export interface Hotspot {
  id: string
  lat: number
  lng: number
  brightnessK: number | null
  frp: number | null
  confidence: string | null
  detectedAt: string
  satellite: string | null
}
