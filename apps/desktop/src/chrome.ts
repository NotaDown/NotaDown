import { nativeTheme } from 'electron'
import { getThemeTokens, type TitleBarMode } from '@notadown/shared'
import { loadSettings } from './state'

export interface WindowChrome {
  titleBarMode: TitleBarMode
  overlay: {
    color: string
    symbolColor: string
  }
}

// One pixel shorter than the 44px app title bar so its bottom border stays outside the native caption overlay.
export const TITLE_BAR_OVERLAY_HEIGHT = 43

let chrome: WindowChrome = {
  titleBarMode: 'integrated',
  overlay: { color: '#fbfbfa', symbolColor: '#575752' },
}

export function getWindowChrome(): WindowChrome {
  return chrome
}

export async function resolveWindowChrome(): Promise<WindowChrome> {
  let settings: Awaited<ReturnType<typeof loadSettings>> = null
  try {
    settings = await loadSettings()
  } catch {
    settings = null
  }

  const titleBarMode: TitleBarMode =
    settings?.titleBarMode === 'native' ? 'native' : 'integrated'
  const colorMode =
    settings?.colorMode === 'light' || settings?.colorMode === 'dark'
      ? settings.colorMode
      : nativeTheme.shouldUseDarkColors
        ? 'dark'
        : 'light'
  const tokens = getThemeTokens(settings?.theme ?? 'default', colorMode)

  chrome = {
    titleBarMode,
    overlay: { color: tokens.bg, symbolColor: tokens.textSecondary },
  }
  return chrome
}

export function updateOverlayColors(color: string, symbolColor: string): void {
  chrome = { ...chrome, overlay: { color, symbolColor } }
}
