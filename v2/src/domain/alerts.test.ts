import { describe, it, expect } from 'vitest'
import { deriveAlerts, derivePlaceAlerts } from './alerts'
import type { Fire } from './fire'
import type { SavedPlace } from './places'

const now = new Date('2026-07-08T12:00:00Z')

const fire = (o: Partial<Fire>): Fire => ({
  id: 'f', source: 's', externalId: null, name: 'Test Fire', cause: null,
  severity: 'low', status: 'active', containmentPct: 0, acres: 100,
  discoveredAt: '2026-01-01T00:00:00Z', endedAt: null,
  location: { lat: 0, lng: 0, description: 'Nowhere' },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: now.toISOString(),
  ...o,
})

describe('deriveAlerts', () => {
  it('flags extreme fires with low containment as critical', () => {
    const alerts = deriveAlerts([fire({ id: 'a', severity: 'extreme', containmentPct: 10 })], now)
    expect(alerts.some((x) => x.id === 'a:extreme' && x.level === 'critical')).toBe(true)
  })

  it('does not flag extreme fires that are well contained', () => {
    const alerts = deriveAlerts([fire({ severity: 'extreme', containmentPct: 60 })], now)
    expect(alerts.some((x) => x.id.endsWith(':extreme'))).toBe(false)
  })

  it('flags hazardous air quality', () => {
    const alerts = deriveAlerts([fire({ id: 'b', weather: { windSpeedMph: null, windDirectionDeg: null, aqi: 240 } })], now)
    expect(alerts.some((x) => x.id === 'b:aqi' && x.level === 'critical')).toBe(true)
  })

  it('flags brand-new active incidents as warnings', () => {
    const alerts = deriveAlerts([fire({ id: 'c', discoveredAt: '2026-07-08T06:00:00Z' })], now)
    expect(alerts.some((x) => x.id === 'c:new' && x.level === 'warning')).toBe(true)
  })

  it('ignores fires that are out', () => {
    expect(deriveAlerts([fire({ status: 'out', severity: 'extreme', containmentPct: 0 })], now)).toHaveLength(0)
  })

  it('sorts critical before warning', () => {
    const alerts = deriveAlerts(
      [fire({ id: 'x', severity: 'extreme', containmentPct: 5, discoveredAt: '2026-07-08T06:00:00Z' })],
      now,
    )
    const levels = alerts.map((a) => a.level)
    expect(levels.indexOf('critical')).toBeLessThan(levels.indexOf('warning'))
  })
})

const place = (o: Partial<SavedPlace> = {}): SavedPlace => ({
  id: 'p', name: 'Home', lat: 0, lng: 0, color: '#fff', alertEnabled: true, alertRadiusKm: 40, ...o,
})

describe('derivePlaceAlerts', () => {
  it('with no places, surfaces only critical-priority fires', () => {
    const fires = [
      fire({ id: 'crit', acres: 20_000, containmentPct: 10, location: { lat: 50, lng: 50, description: null } }),
      fire({ id: 'calm', acres: 50, containmentPct: 90, location: { lat: 50, lng: 50, description: null } }),
    ]
    const ids = derivePlaceAlerts(fires, []).map((a) => a.fireId)
    expect(ids).toContain('crit')
    expect(ids).not.toContain('calm')
  })

  it('surfaces a non-critical fire only when it is within a place radius', () => {
    const home = place({ lat: 34.05, lng: -118.24, alertRadiusKm: 40 })
    const nearFire = fire({ id: 'near', acres: 200, containmentPct: 60, location: { lat: 34.1, lng: -118.2, description: null } })
    const farFire = fire({ id: 'far', acres: 200, containmentPct: 60, location: { lat: 40, lng: -100, description: null } })
    const alerts = derivePlaceAlerts([nearFire, farFire], [home])
    expect(alerts.some((a) => a.fireId === 'near' && a.id === 'near:prox')).toBe(true)
    expect(alerts.some((a) => a.fireId === 'far')).toBe(false)
  })

  it('excludes fires that are out even if near a place', () => {
    const home = place({ lat: 0, lng: 0 })
    const outFire = fire({ id: 'o', status: 'out', location: { lat: 0, lng: 0, description: null } })
    expect(derivePlaceAlerts([outFire], [home])).toHaveLength(0)
  })
})
