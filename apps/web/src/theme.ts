import {
  getThemeTokens,
  themeTokensToCss,
  type AppSettings,
  type ColorMode,
  type PageWidthMode,
  type ThemeId,
} from '@notadown/shared'

const UI_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
const EDITOR_FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif"
const DISPLAY_FONT =
  "'Iowan Old Style', 'Palatino Linotype', 'Source Serif 4', Georgia, 'Songti SC', 'Noto Serif SC', serif"
const MONO_FONT =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"

const PAGE_WIDTHS: Record<PageWidthMode, string> = {
  narrow: '760px',
  default: '1024px',
  wide: '1200px',
  full: '100%',
}

export function resolveColorMode(mode: ColorMode, systemDark: boolean): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode
  return systemDark ? 'dark' : 'light'
}

export interface ThemeApplication {
  theme: ThemeId
  mode: 'light' | 'dark'
  fontFamily: string
  monospace: boolean
  fontSize: number
  lineHeight: number
  pageWidth: PageWidthMode
  customCss: string
}

export function applyTheme(application: ThemeApplication): void {
  const tokens = themeTokensToCss(getThemeTokens(application.theme, application.mode))
  const editorFont = application.monospace
    ? MONO_FONT
    : application.fontFamily.trim() || EDITOR_FONT
  const displayFont = application.fontFamily.trim()
    ? `${application.fontFamily.trim()}, ${DISPLAY_FONT}`
    : DISPLAY_FONT

  const variables: Record<string, string> = {
    ...tokens,
    '--nd-font-ui': UI_FONT,
    '--nd-font-editor': editorFont,
    '--nd-font-display': displayFont,
    '--nd-font-mono': MONO_FONT,
    '--nd-editor-font-size': `${application.fontSize}px`,
    '--nd-line-height': String(application.lineHeight),
    '--nd-editor-width': PAGE_WIDTHS[application.pageWidth],
  }

  const declarations = Object.entries(variables)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n')

  const style = getStyleElement('nd-theme-vars')
  if (style.textContent !== declarations) style.textContent = `:root {\n${declarations}\n}`

  const customCss = getStyleElement('nd-custom-css')
  if (customCss.textContent !== application.customCss) {
    customCss.textContent = application.customCss
  }

  const root = document.documentElement
  root.dataset.theme = application.theme
  root.dataset.colorMode = application.mode
  root.style.colorScheme = application.mode
}

export function applySettingsTheme(
  settings: AppSettings,
  systemDark: boolean,
): void {
  applyTheme({
    theme: settings.theme,
    mode: resolveColorMode(settings.colorMode, systemDark),
    fontFamily: settings.fontFamily,
    monospace: settings.editorFontMonospace,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    pageWidth: settings.pageWidth,
    customCss: settings.customCss,
  })
}

export function bootstrapTheme(): void {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  applyTheme({
    theme: 'default',
    mode: dark ? 'dark' : 'light',
    fontFamily: '',
    monospace: false,
    fontSize: 17,
    lineHeight: 1.75,
    pageWidth: 'default',
    customCss: '',
  })
}

function getStyleElement(id: string): HTMLStyleElement {
  const existing = document.getElementById(id)
  if (existing instanceof HTMLStyleElement) return existing
  const element = document.createElement('style')
  element.id = id
  document.head.append(element)
  return element
}
