import { describe, expect, it } from 'vitest'
import { detectBulletMarker } from '../src/bullet-marker'

describe('detectBulletMarker', () => {
  it('defaults to a dash without unordered lists', () => {
    expect(detectBulletMarker('')).toBe('-')
    expect(detectBulletMarker('# Title\n\n1. first\n2. second\n')).toBe('-')
  })

  it('keeps the dominant marker of the source', () => {
    expect(detectBulletMarker('- one\n- two\n')).toBe('-')
    expect(detectBulletMarker('* one\n* two\n* three\n')).toBe('*')
    expect(detectBulletMarker('+ one\n+ two\n')).toBe('+')
  })

  it('counts nested and quoted items', () => {
    expect(detectBulletMarker('* top\n  * nested\n    * deeper\n')).toBe('*')
    expect(detectBulletMarker('> * quoted\n> * quoted again\n')).toBe('*')
  })

  it('ignores fenced code, thematic breaks and emphasis', () => {
    const markdown = [
      '```md',
      '* not a list',
      '- also not a list',
      '```',
      '---',
      '* * *',
      'text with *emphasis*',
      '- real item',
    ].join('\n')
    expect(detectBulletMarker(markdown)).toBe('-')
  })

  it('prefers a dash when markers are evenly mixed', () => {
    expect(detectBulletMarker('* one\n- two\n')).toBe('-')
  })
})
