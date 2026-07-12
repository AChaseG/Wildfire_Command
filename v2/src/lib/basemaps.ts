import type { StyleSpecification } from 'maplibre-gl'

export interface Basemap {
  id: string
  label: string
  style: string | StyleSpecification
}

// Satellite is a raster style (Esri World Imagery — keyless) built inline; the
// others are keyless CARTO vector styles.
const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
}

// An optional custom style via VITE_MAP_STYLE becomes the first option and the
// default. Truthiness check so an empty string (unset var in CI) is ignored.
const custom = import.meta.env.VITE_MAP_STYLE

export const BASEMAPS: Basemap[] = [
  ...(custom ? [{ id: 'custom', label: 'Custom', style: custom }] : []),
  { id: 'dark', label: 'Dark', style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light', label: 'Light', style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'streets', label: 'Streets', style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'satellite', label: 'Satellite', style: SATELLITE },
]

export const DEFAULT_BASEMAP_ID = custom ? 'custom' : 'dark'

export function basemapStyle(id: string): string | StyleSpecification {
  return (BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0]!).style
}
