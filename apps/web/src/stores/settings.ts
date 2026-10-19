import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AppSettings,
} from '@notadown/shared'
import { detectLocale } from '@notadown/i18n'
import { platform } from '@/platform'
import { i18n } from '@/i18n'
import { applySettingsTheme, resolveColorMode } from '@/theme'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)
  const systemDark = ref(
    typeof window !== 'undefined'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
      : false,
  )

  const locale = computed(() => detectLocale(settings.value.locale))
  const effectiveMode = computed(() => resolveColorMode(settings.value.colorMode, systemDark.value))

  let saveTimer: number | null = null

  async function init(): Promise<void> {
    try {
      const stored = await platform.loadSettings()
      settings.value = normalizeSettings(stored)
    } catch {
      settings.value = normalizeSettings(null)
    }
    loaded.value = true
    apply()
  }

  function update(patch: Partial<AppSettings>): void {
    settings.value = { ...settings.value, ...patch }
  }

  function reset(): void {
    settings.value = normalizeSettings(null)
  }

  function snapshot(): AppSettings {
    // Reactive proxies are not structured-cloneable for IndexedDB.
    return JSON.parse(JSON.stringify(settings.value)) as AppSettings
  }

  function flush(): void {
    if (saveTimer) {
      window.clearTimeout(saveTimer)
      saveTimer = null
    }
    void platform.saveSettings(snapshot()).catch(() => undefined)
  }

  function scheduleSave(): void {
    if (!loaded.value) return
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      saveTimer = null
      void platform.saveSettings(snapshot()).catch(() => undefined)
    }, 350)
  }

  function apply(): void {
    applySettingsTheme(settings.value, systemDark.value)
    if (i18n.global.locale.value !== locale.value) {
      i18n.global.locale.value = locale.value
    }
    document.documentElement.lang = locale.value
  }

  watch(settings, () => {
    apply()
    scheduleSave()
  }, { deep: true })

  watch(systemDark, () => {
    if (settings.value.colorMode === 'system') apply()
  })

  if (typeof window !== 'undefined') {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    query?.addEventListener?.('change', (event) => {
      systemDark.value = event.matches
    })
  }

  return {
    settings,
    loaded,
    systemDark,
    locale,
    effectiveMode,
    init,
    update,
    reset,
    flush,
  }
})
