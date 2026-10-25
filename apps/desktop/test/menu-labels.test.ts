import { describe, expect, it } from 'vitest'
import { menuLabels, resolveMenuLocale } from '../src/menu-labels'

describe('menuLabels', () => {
  it('returns English labels', () => {
    expect(menuLabels('en-US').file).toBe('File')
    expect(menuLabels('en-US').openFile).toBe('Open File…')
  })

  it('returns Chinese labels', () => {
    expect(menuLabels('zh-CN').file).toBe('文件')
    expect(menuLabels('zh-CN').openFile).toBe('打开文件…')
  })
})

describe('resolveMenuLocale', () => {
  it('honors an explicit preference over the system locale', () => {
    expect(resolveMenuLocale('zh-CN', 'de-DE')).toBe('zh-CN')
    expect(resolveMenuLocale('en-US', 'zh-CN')).toBe('en-US')
  })

  it('follows Chinese system locales', () => {
    expect(resolveMenuLocale('system', 'zh-CN')).toBe('zh-CN')
    expect(resolveMenuLocale('system', 'zh-TW')).toBe('zh-CN')
    expect(resolveMenuLocale(undefined, 'zh-Hans-CN')).toBe('zh-CN')
  })

  it('falls back to English for other system locales', () => {
    expect(resolveMenuLocale('system', 'de-DE')).toBe('en-US')
    expect(resolveMenuLocale(undefined, 'en-GB')).toBe('en-US')
  })
})
