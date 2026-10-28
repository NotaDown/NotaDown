import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createId } from '@notadown/shared'
import type { HistoryRecord, SidebarView, ToastMessage } from '@notadown/shared'
import type { FindResult } from '@notadown/editor'
import { useSettingsStore } from './settings'

export type SettingsSection =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'files'
  | 'history'
  | 'shortcuts'
  | 'updates'
  | 'about'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface ConfirmState extends ConfirmOptions {
  id: string
}

export interface UnsavedState {
  id: string
  name: string
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export const useUiStore = defineStore('ui', () => {
  const settings = useSettingsStore()

  const sidebarOpen = ref(true)
  const sidebarView = ref<SidebarView>('files')
  const sidebarWidth = computed({
    get: () => settings.settings.sidebarWidth,
    set: (value: number) => settings.update({ sidebarWidth: Math.round(value) }),
  })

  const settingsOpen = ref(false)
  const settingsSection = ref<SettingsSection>('general')
  const shortcutsOpen = ref(false)
  const paletteOpen = ref(false)
  const quickOpenOpen = ref(false)
  const defaultAppOpen = ref(false)
  const updateOpen = ref(false)

  const findOpen = ref(false)
  const findQuery = ref('')
  const findResult = ref<FindResult | null>(null)

  // Where the user last worked by pointer or keyboard. Opening a document from
  // the tree moves DOM focus into the editor, so focus alone cannot tell F2
  // whether the intent is the tree entry or the document.
  const workArea = ref<'tree' | 'editor'>('tree')

  const toasts = ref<ToastMessage[]>([])
  const confirmState = ref<ConfirmState | null>(null)
  const unsavedState = ref<UnsavedState | null>(null)
  const historyRecord = ref<HistoryRecord | null>(null)
  const historyView = ref<'preview' | 'compare'>('preview')
  const historyListToken = ref(0)
  const searchFocusToken = ref(0)

  let confirmResolver: ((value: boolean) => void) | null = null
  let unsavedResolver: ((value: UnsavedChoice) => void) | null = null
  const toastTimers = new Map<string, number>()

  const hasBlockingModal = computed(
    () =>
      settingsOpen.value ||
      shortcutsOpen.value ||
      paletteOpen.value ||
      quickOpenOpen.value ||
      defaultAppOpen.value ||
      updateOpen.value ||
      confirmState.value !== null ||
      unsavedState.value !== null ||
      historyRecord.value !== null,
  )

  function toggleSidebar(value?: boolean): void {
    sidebarOpen.value = value ?? !sidebarOpen.value
  }

  function setSidebarView(view: SidebarView): void {
    sidebarView.value = view
    sidebarOpen.value = true
  }

  function focusSearch(): void {
    setSidebarView('search')
    searchFocusToken.value += 1
  }

  function setWorkArea(area: 'tree' | 'editor'): void {
    workArea.value = area
  }

  function openSettings(section: SettingsSection = 'general'): void {
    settingsSection.value = section
    settingsOpen.value = true
  }

  function openFind(): void {
    findOpen.value = true
  }

  function closeFind(): void {
    findOpen.value = false
    findResult.value = null
  }

  function toast(
    type: ToastMessage['type'],
    message: string,
    detail?: string,
    duration?: number,
  ): string {
    const id = createId('toast')
    const entry: ToastMessage = {
      id,
      type,
      message,
      detail,
      duration: duration ?? (type === 'error' ? 5200 : 3200),
    }
    toasts.value = [...toasts.value, entry].slice(-4)
    const timer = window.setTimeout(() => dismissToast(id), entry.duration)
    toastTimers.set(id, timer)
    return id
  }

  function dismissToast(id: string): void {
    const timer = toastTimers.get(id)
    if (timer) window.clearTimeout(timer)
    toastTimers.delete(id)
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    if (confirmState.value) {
      resolveConfirm(false)
    }
    confirmState.value = { id: createId('confirm'), ...options }
    return new Promise<boolean>((resolve) => {
      confirmResolver = resolve
    })
  }

  function resolveConfirm(value: boolean): void {
    confirmState.value = null
    const resolver = confirmResolver
    confirmResolver = null
    resolver?.(value)
  }

  function askUnsaved(name: string): Promise<UnsavedChoice> {
    if (unsavedState.value) resolveUnsaved('cancel')
    unsavedState.value = { id: createId('unsaved'), name }
    return new Promise<UnsavedChoice>((resolve) => {
      unsavedResolver = resolve
    })
  }

  function resolveUnsaved(choice: UnsavedChoice): void {
    unsavedState.value = null
    const resolver = unsavedResolver
    unsavedResolver = null
    resolver?.(choice)
  }

  function openHistoryDialog(record: HistoryRecord, view: 'preview' | 'compare' = 'preview'): void {
    historyRecord.value = record
    historyView.value = view
  }

  function closeHistoryDialog(): void {
    historyRecord.value = null
    historyView.value = 'preview'
  }

  function notifyHistoryChanged(): void {
    historyListToken.value += 1
  }

  function closeTopLayer(): boolean {
    if (confirmState.value) {
      resolveConfirm(false)
      return true
    }
    if (unsavedState.value) {
      resolveUnsaved('cancel')
      return true
    }
    if (historyRecord.value) {
      closeHistoryDialog()
      return true
    }
    if (paletteOpen.value) {
      paletteOpen.value = false
      return true
    }
    if (quickOpenOpen.value) {
      quickOpenOpen.value = false
      return true
    }
    if (defaultAppOpen.value) {
      defaultAppOpen.value = false
      return true
    }
    if (updateOpen.value) {
      updateOpen.value = false
      return true
    }
    if (settingsOpen.value) {
      settingsOpen.value = false
      return true
    }
    if (shortcutsOpen.value) {
      shortcutsOpen.value = false
      return true
    }
    if (findOpen.value) {
      closeFind()
      return true
    }
    return false
  }

  return {
    sidebarOpen,
    sidebarView,
    sidebarWidth,
    settingsOpen,
    settingsSection,
    shortcutsOpen,
    paletteOpen,
    quickOpenOpen,
    defaultAppOpen,
    updateOpen,
    findOpen,
    findQuery,
    findResult,
    workArea,
    toasts,
    confirmState,
    unsavedState,
    historyRecord,
    historyView,
    historyListToken,
    searchFocusToken,
    hasBlockingModal,
    toggleSidebar,
    setSidebarView,
    focusSearch,
    setWorkArea,
    openSettings,
    openFind,
    closeFind,
    toast,
    dismissToast,
    confirm,
    resolveConfirm,
    askUnsaved,
    resolveUnsaved,
    openHistoryDialog,
    closeHistoryDialog,
    notifyHistoryChanged,
    closeTopLayer,
  }
})
