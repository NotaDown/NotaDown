import { computed, ref } from 'vue'
import type { TitleBarMode } from '@notadown/shared'
import { platform } from '@/platform'

export const appliedTitleBarMode = ref<TitleBarMode>(
  typeof window === 'undefined'
    ? 'integrated'
    : (window.notadown?.titleBarMode ?? 'integrated'),
)
export const usesNativeTitleBar = computed(
  () => platform.kind === 'desktop' && appliedTitleBarMode.value === 'native',
)
export const desktopPlatform = ref(
  typeof window === 'undefined' ? '' : (window.notadown?.platform ?? ''),
)
/** The integrated title bar on Windows / Linux floats the system window buttons over the top-right corner, so content has to step aside. */
export const usesOverlayWindowControls = computed(
  () =>
    platform.kind === 'desktop' &&
    appliedTitleBarMode.value === 'integrated' &&
    desktopPlatform.value !== 'darwin',
)
