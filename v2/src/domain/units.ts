export type UnitSystem = 'imperial' | 'metric'

const ACRES_PER_HECTARE = 2.471_05
const KM_PER_MILE = 1.609_344

export function acresToHectares(acres: number): number {
  return acres / ACRES_PER_HECTARE
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE
}

export function milesToKm(mi: number): number {
  return mi * KM_PER_MILE
}

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

export function degToCompass(deg: number): string {
  const normalized = (((deg % 360) + 360) % 360) / 22.5
  return COMPASS[Math.round(normalized) % 16]
}

export function formatArea(acres: number, system: UnitSystem): string {
  if (system === 'metric') {
    return `${Math.round(acresToHectares(acres)).toLocaleString('en-US')} ha`
  }
  return `${Math.round(acres).toLocaleString('en-US')} ac`
}

export function formatDistance(km: number, system: UnitSystem): string {
  if (system === 'metric') {
    return `${km.toFixed(km < 10 ? 1 : 0)} km`
  }
  const mi = kmToMiles(km)
  return `${mi.toFixed(km < 16 ? 1 : 0)} mi`
}

export function formatWind(
  speedMph: number | null,
  directionDeg: number | null,
  system: UnitSystem,
): string {
  if (speedMph == null) return '—'
  const speed =
    system === 'metric'
      ? `${Math.round(speedMph * KM_PER_MILE)} km/h`
      : `${Math.round(speedMph)} mph`
  const dir = directionDeg == null ? '' : ` ${degToCompass(directionDeg)}`
  return `${speed}${dir}`
}
