import { describe, it, expect } from 'vitest'
import { isWildfireRelated, normalizeBaseUrl, parseTransmissions } from './transcriber'

describe('normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl('  https://x.example/  ')).toBe('https://x.example')
    expect(normalizeBaseUrl('https://x.example')).toBe('https://x.example')
  })
})

describe('isWildfireRelated', () => {
  it('matches wildland chatter', () => {
    expect(isWildfireRelated('Brush fire spreading, requesting air tanker')).toBe(true)
    expect(isWildfireRelated('spot fires across the highway, 20 acres')).toBe(true)
    expect(isWildfireRelated('vegetation fire near the ridge')).toBe(true)
    expect(isWildfireRelated('containment holding on the north line')).toBe(true)
  })

  it('ignores unrelated and structure/vehicle fires', () => {
    expect(isWildfireRelated('Traffic stop on Main Street')).toBe(false)
    expect(isWildfireRelated('Structure fire, two-story residential')).toBe(false)
    expect(isWildfireRelated('Vehicle fire on the interstate')).toBe(false)
  })

  it('keeps a structure fire that spread to wildland', () => {
    expect(isWildfireRelated('Structure fire extending into the brush, 5 acres involved')).toBe(true)
  })
})

describe('parseTransmissions', () => {
  it('normalizes fields, builds audio URLs, drops empty text, sorts newest first', () => {
    const rows = parseTransmissions(
      {
        transmissions: [
          { id: 1, channel: 'County Fire', text: 'older', timestamp: '2026-07-14T00:00:00Z', duration: 3, filename: 'a.wav' },
          { id: 2, channel_name: 'CAL FIRE', transcript: 'newer', created_at: '2026-07-14T01:00:00Z' },
          { id: 3, text: '   ' }, // dropped: empty
        ],
      },
      'https://scan.example/',
    )
    expect(rows.map((r) => r.id)).toEqual(['2', '1'])
    expect(rows[1].channel).toBe('County Fire')
    expect(rows[1].audioUrl).toBe('https://scan.example/audio/a.wav')
    expect(rows[0].channel).toBe('CAL FIRE')
    expect(rows[0].audioUrl).toBeNull()
  })

  it('accepts a bare array and tolerates missing shapes', () => {
    expect(parseTransmissions([{ text: 'brush fire' }], 'https://x')).toHaveLength(1)
    expect(parseTransmissions(null, 'https://x')).toEqual([])
    expect(parseTransmissions({}, 'https://x')).toEqual([])
  })
})
