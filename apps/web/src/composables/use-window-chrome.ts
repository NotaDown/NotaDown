import { onMounted, watch } from 'vue'
import { getThemeTokens } from '@notadown/shared'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import { appliedTitleBarMode, desktopPlatform } from '@/window-chrome'

export function useWindowChrome(): void {
  if (platform.kind !== 'desktop') return
  const bridge = window.notadown
  if (!bridge) return
  const desktopBridge = bridge

  const settings = useSettingsStore()
  desktopPlatform.value = desktopBridge.platform

  onMounted(async () => {
    try {
      appliedTitleBarMode.value = await desktopBridge.invoke('getTitleBarMode')
    } catch {
      appliedTitleBarMode.value = settings.settings.titleBarMode
    }
    syncOverlay()
  })

  watch(
    () => [settings.settings.theme, settings.effectiveMode] as const,
    () => syncOverlay(),
  )

  function syncOverlay(): void {
    if (desktopBridge.platform === 'darwin' || appliedTitleBarMode.value !== 'integrated') return
    const tokens = getThemeTokens(settings.settings.theme, settings.effectiveMode)
    void desktopBridge
      .invoke('setTitleBarOverlay', tokens.bg, tokens.textSecondary)
      .catch(() => undefined)
  }
}
