import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from '../src'

describe('normalizeSettings', () => {
  it('defaults to the default page width mode', () => {
    expect(normalizeSettings({}).pageWidth).toBe('default')
  })

  it('accepts every supported page width mode', () => {
    for (const pageWidth of [
      'very-narrow',
      'narrow',
      'default',
      'wide',
      'full',
    ] as const) {
      expect(normalizeSettings({ pageWidth }).pageWidth).toBe(pageWidth)
    }
  })

  it('falls back to the default page width for unknown values', () => {
    expect(normalizeSettings({ pageWidth: 'huge' }).pageWidth).toBe(DEFAULT_SETTINGS.pageWidth)
    expect(normalizeSettings({ pageWidth: 1200 }).pageWidth).toBe(DEFAULT_SETTINGS.pageWidth)
  })

  it('accepts every interface density and rejects unknown values', () => {
    for (const uiDensity of ['compact', 'default', 'comfortable'] as const) {
      expect(normalizeSettings({ uiDensity }).uiDensity).toBe(uiDensity)
    }
    expect(normalizeSettings({ uiDensity: 'dense' }).uiDensity).toBe(
      DEFAULT_SETTINGS.uiDensity,
    )
    expect(normalizeSettings({ uiDensity: 1 }).uiDensity).toBe(DEFAULT_SETTINGS.uiDensity)
  })

  it('validates the update download source', () => {
    expect(normalizeSettings({ updateDownloadSource: 'auto' }).updateDownloadSource).toBe('auto')
    expect(normalizeSettings({ updateDownloadSource: 'github' }).updateDownloadSource).toBe(
      'github',
    )
    expect(normalizeSettings({ updateDownloadSource: 'mirror' }).updateDownloadSource).toBe(
      DEFAULT_SETTINGS.updateDownloadSource,
    )
  })
})
