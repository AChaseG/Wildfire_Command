import { describe, it, expect } from 'vitest'
import { deriveAlerts } from './alerts'
import type { Fire } from './fire'

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
