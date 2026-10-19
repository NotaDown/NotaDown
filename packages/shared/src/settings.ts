import type {
  ColorMode,
  ImageStorageMode,
  LocalePreference,
  ThemeId,
} from './types'

export interface AppSettings {
  locale: LocalePreference
  colorMode: ColorMode
  theme: ThemeId
  customCss: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  editorWidth: number
  autosave: boolean
  autosaveDelay: number
  spellcheck: boolean
  focusMode: boolean
  typewriterMode: boolean
  showWordCount: boolean
  restoreSession: boolean
  confirmDelete: boolean
  imageStorage: ImageStorageMode
  imageFileNamePattern: string
  documentAssetsDir: string
  globalAttachmentsDir: string
  defaultFileExtension: 'md' | 'markdown'
  historyEnabled: boolean
  historyIntervalMinutes: number
  historyMaxPerFile: number
  historyRetentionDays: number
  sidebarWidth: number
  editorFontMonospace: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'system',
  colorMode: 'system',
  theme: 'default',
  customCss: '',
  fontFamily: '',
  fontSize: 17,
  lineHeight: 1.75,
  editorWidth: 760,
  autosave: true,
  autosaveDelay: 800,
  spellcheck: true,
  focusMode: false,
  typewriterMode: false,
  showWordCount: true,
  restoreSession: true,
  confirmDelete: true,
  imageStorage: 'document-assets',
  imageFileNamePattern: '${timestamp}-${random}',
  documentAssetsDir: 'assets',
  globalAttachmentsDir: 'attachments',
  defaultFileExtension: 'md',
  historyEnabled: true,
  historyIntervalMinutes: 2,
  historyMaxPerFile: 100,
  historyRetentionDays: 90,
  sidebarWidth: 260,
  editorFontMonospace: false,
}

type NumberRule = { min: number; max: number }

const NUMBER_RULES: Partial<Record<keyof AppSettings, NumberRule>> = {
  fontSize: { min: 12, max: 32 },
  lineHeight: { min: 1.2, max: 2.6 },
  editorWidth: { min: 480, max: 1400 },
  autosaveDelay: { min: 200, max: 10000 },
  historyIntervalMinutes: { min: 1, max: 120 },
  historyMaxPerFile: { min: 5, max: 1000 },
  historyRetentionDays: { min: 1, max: 3650 },
  sidebarWidth: { min: 180, max: 480 },
}

const COLOR_MODES = new Set(['system', 'light', 'dark'])
const THEMES = new Set(['default', 'paper', 'nordic', 'contrast'])
const LOCALES = new Set(['system', 'en-US', 'zh-CN'])
const IMAGE_MODES = new Set([
  'document-assets',
  'document-named',
  'global-attachments',
  'base64',
])

export function normalizeSettings(input: unknown): AppSettings {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const result: AppSettings = { ...DEFAULT_SETTINGS }

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    const value = source[key]
    if (value === undefined) continue

    const defaultValue = DEFAULT_SETTINGS[key]
    if (typeof defaultValue === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      const rule = NUMBER_RULES[key]
      result[key] = (rule ? Math.min(rule.max, Math.max(rule.min, value)) : value) as never
    } else if (typeof defaultValue === 'boolean') {
      if (typeof value === 'boolean') result[key] = value as never
    } else if (typeof defaultValue === 'string') {
      if (typeof value !== 'string') continue
      if (key === 'colorMode' && !COLOR_MODES.has(value)) continue
      if (key === 'theme' && !THEMES.has(value)) continue
      if (key === 'locale' && !LOCALES.has(value)) continue
      if (key === 'imageStorage' && !IMAGE_MODES.has(value)) continue
      if (key === 'defaultFileExtension' && !['md', 'markdown'].includes(value)) continue
      result[key] = value as never
    }
  }

  result.imageFileNamePattern = sanitizePattern(result.imageFileNamePattern)
  result.documentAssetsDir = sanitizeFolderName(result.documentAssetsDir, 'assets')
  result.globalAttachmentsDir = sanitizeFolderName(result.globalAttachmentsDir, 'attachments')

  return result
}

export function sanitizePattern(pattern: string): string {
  const trimmed = pattern.trim()
  if (!trimmed) return DEFAULT_SETTINGS.imageFileNamePattern
  return trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120)
}

export function sanitizeFolderName(name: string, fallback: string): string {
  const trimmed = name.trim().replace(/^[/\\]+|[/\\]+$/g, '')
  if (!trimmed || trimmed === '.' || trimmed === '..') return fallback
  return trimmed.replace(/[<>:"|?*\u0000-\u001f]/g, '-').slice(0, 100)
}
