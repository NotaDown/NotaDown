import { ref } from 'vue'
import type { TitleBarMode } from '@notadown/shared'

export const appliedTitleBarMode = ref<TitleBarMode>('integrated')
export const desktopPlatform = ref(
  typeof window === 'undefined' ? '' : (window.notadown?.platform ?? ''),
)
