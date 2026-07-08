import { describe, it, expect } from 'vitest'
import { parseFirmsCsv } from './firms'

const CSV = [
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight',
  '34.05,-118.53,330.1,0.4,0.36,2026-07-08,948,N,VIIRS,h,2.0,295.2,12.4,D',
  '40.10,-121.20,310.0,0.5,0.40,2026-07-08,52,N,VIIRS,n,2.0,290.0,4.1,N',
  'not-a-number,-121.20,310.0,0.5,0.40,2026-07-08,0100,N,VIIRS,n,2.0,290.0,4.1,N',
].join('\n')

describe('parseFirmsCsv', () => {
  const rows = parseFirmsCsv(CSV)

  it('parses valid rows and skips non-numeric coordinates', () => {
    expect(rows).toHaveLength(2)
  })

  it('maps fields by header name', () => {
    expect(rows[0]).toMatchObject({
      source: 'NASA FIRMS', latitude: 34.05, longitude: -118.53,
      brightness_k: 330.1, confidence: 'h', frp: 12.4, satellite: 'N',
    })
  })

  it('builds an ISO timestamp, zero-padding the acquisition time', () => {
    expect(rows[0]!.detected_at).toBe('2026-07-08T09:48:00Z')
    expect(rows[1]!.detected_at).toBe('2026-07-08T00:52:00Z')
  })

  it('returns nothing for an empty or header-only file', () => {
    expect(parseFirmsCsv('')).toHaveLength(0)
    expect(parseFirmsCsv('latitude,longitude,acq_date')).toHaveLength(0)
  })
})
