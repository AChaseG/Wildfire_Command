export const MAP_LAYERS = [
  {
    id: 'satellite',
    name: 'Satellite',
    description: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
    labels: true,
  },
  {
    id: 'street',
    name: 'Street',
    description: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    labels: false,
  },
  {
    id: 'topo',
    name: 'Topographic',
    description: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
    labels: false,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
    maxZoom: 19,
    labels: false,
  },
  {
    id: 'terrain',
    name: 'Terrain',
    description: 'Stamen Terrain',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png',
    attribution: 'Stamen Design, OpenStreetMap contributors',
    maxZoom: 15,
    labels: false,
  },
]

export const LABELS_OVERLAY_URL =
  'https://stamen-tiles.a.ssl.fastly.net/terrain-labels/{z}/{x}/{y}.png'
