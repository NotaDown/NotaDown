import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'

export function useRevealLabel(): ComputedRef<string> {
  const { t } = useI18n()
  const os = typeof window === 'undefined' ? undefined : window.notadown?.platform
  return computed(() => {
    if (os === 'darwin') return t('tabs.revealMac')
    if (os === 'win32') return t('tabs.revealWindows')
    return t('tabs.reveal')
  })
}
