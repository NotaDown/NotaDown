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
/** Windows / Linux 的集成标题栏把系统窗口按钮悬浮在右上角，内容要主动让开。 */
export const usesOverlayWindowControls = computed(
  () =>
    platform.kind === 'desktop' &&
    appliedTitleBarMode.value === 'integrated' &&
    desktopPlatform.value !== 'darwin',
)
