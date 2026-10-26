import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'

const PROMPTED_KEY = 'notadown:default-app-prompted'

export function maybePromptDefaultApp(): void {
  if (!platform.capabilities.defaultAppSettings) return
  try {
    if (localStorage.getItem(PROMPTED_KEY) === '1') return
    localStorage.setItem(PROMPTED_KEY, '1')
  } catch {
    return
  }
  useUiStore().defaultAppOpen = true
}
