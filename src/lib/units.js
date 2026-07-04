export const UNITS = {
  imperial: 'imperial',
  metric: 'metric',
}

const MILES_PER_METER = 0.000621371
const ACRES_PER_SQ_METER = 0.000247105
const SQ_METERS_PER_ACRE = 4046.86
const SQ_METERS_PER_HECTARE = 10_000

export function metersToLength(m, units) {
  if (m == null || Number.isNaN(m)) return '—'
  if (units === UNITS.metric) {
    if (m < 1000) return `${Math.round(m)} m`
    return `${(m / 1000).toFixed(2)} km`
  }
  const mi = m * MILES_PER_METER
  if (mi < 0.1) return `${Math.round(m * 3.28084)} ft`
  return `${mi.toFixed(2)} mi`
}

export function sqMetersToArea(sqM, units) {
  if (sqM == null || Number.isNaN(sqM)) return '—'
  if (units === UNITS.metric) {
    if (sqM < 10_000) return `${Math.round(sqM)} m²`
    return `${(sqM / SQ_METERS_PER_HECTARE).toFixed(2)} ha`
  }
  const acres = sqM * ACRES_PER_SQ_METER
  if (acres < 1) return `${Math.round(sqM * 10.7639)} ft²`
  if (acres < 640) return `${acres.toFixed(2)} ac`
  return `${(acres / 640).toFixed(3)} mi²`
}

export function acresToArea(acres, units) {
  if (acres == null) return '—'
  if (units === UNITS.metric) {
    const ha = acres * SQ_METERS_PER_ACRE / SQ_METERS_PER_HECTARE
    if (ha < 1) return `${Math.round(acres * SQ_METERS_PER_ACRE)} m²`
    return `${ha.toFixed(2)} ha`
  }
  if (acres < 1) return `${Math.round(acres * 43_560)} ft²`
  if (acres < 640) return `${acres.toFixed(2)} ac`
  return `${(acres / 640).toFixed(3)} mi²`
}

export function acresLabel(acres, units) {
  if (acres == null) return '—'
  if (units === UNITS.metric) {
    const ha = acres * SQ_METERS_PER_ACRE / SQ_METERS_PER_HECTARE
    return `${ha.toLocaleString('en-US', { maximumFractionDigits: 2 })} ha`
  }
  return `${acres.toLocaleString('en-US')} ac`
}

export function windSpeedLabel(mph, units) {
  if (mph == null) return '—'
  if (units === UNITS.metric) {
    return `${Math.round(mph * 1.60934)} kph`
  }
  return `${Math.round(mph)} mph`
}

export function lengthUnitLabel(units) {
  return units === UNITS.metric ? 'm / km' : 'ft / mi'
}

export function areaUnitLabel(units) {
  return units === UNITS.metric ? 'm² / ha' : 'ft² / ac / mi²'
}
