import { describe, it, expect } from 'vitest'
import { gdeltQuery, parseGdelt, parseSeenDate } from './fireNews'
import type { Fire } from '../domain'

const fire = (name: string): Fire => ({
  id: 'f', source: 'NIFC WFIGS', externalId: 'x', name, cause: null,
  severity: 'high', status: 'active', containmentPct: 0, acres: 1,
  discoveredAt: '2026-07-01T00:00:00Z', endedAt: null,
  location: { lat: 34, lng: -118, description: 'Los Angeles County, CA' },
  weather: { windSpeedMph: null, windDirectionDeg: null, aqi: null },
  summary: null, monitored: false, updatedAt: '2026-07-01T00:00:00Z',
})

describe('gdeltQuery', () => {
  it('quotes the core place-name, drops the trailing "Fire", and scopes to US', () => {
    expect(gdeltQuery(fire('Palisades Fire'))).toBe('"Palisades" fire sourcecountry:US')
    expect(gdeltQuery(fire('Bear Complex Fire'))).toBe('"Bear Complex" fire sourcecountry:US')
  })

  it('falls back to the full name when the core is too short', () => {
    expect(gdeltQuery(fire('LA Fire'))).toBe('"LA Fire" fire sourcecountry:US')
  })
})

describe('parseSeenDate', () => {
  it('converts GDELT YYYYMMDDTHHMMSSZ to ISO', () => {
    expect(parseSeenDate('20260712T131500Z')).toBe('2026-07-12T13:15:00Z')
  })
  it('returns null for missing or malformed values', () => {
    expect(parseSeenDate(undefined)).toBeNull()
    expect(parseSeenDate('2026-07-12')).toBeNull()
  })
})

describe('parseGdelt', () => {
  const payload = {
    articles: [
      { url: 'https://a.com/1', title: 'Older story', domain: 'a.com', seendate: '20260710T090000Z' },
      { url: 'https://b.com/2', title: 'Newer story', domain: 'b.com', seendate: '20260712T120000Z' },
      { url: 'https://a.com/1', title: 'Duplicate url', domain: 'a.com', seendate: '20260711T000000Z' },
      { url: '', title: 'No url', domain: 'c.com', seendate: '20260712T000000Z' },
    ],
  }

  it('maps, de-dupes by url, drops empties, and sorts newest first', () => {
    const items = parseGdelt(payload)
    expect(items.map((i) => i.url)).toEqual(['https://b.com/2', 'https://a.com/1'])
    expect(items[0].title).toBe('Newer story')
    expect(items[0].publishedAt).toBe('2026-07-12T12:00:00Z')
  })

  it('derives a domain from the url when GDELT omits it', () => {
    const items = parseGdelt({ articles: [{ url: 'https://www.cnn.com/x', title: 'T' }] })
    expect(items[0].domain).toBe('cnn.com')
  })

  it('is safe on empty/absent payloads', () => {
    expect(parseGdelt(null)).toEqual([])
    expect(parseGdelt({})).toEqual([])
  })
})
