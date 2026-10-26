import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UpdateSnapshot } from '@notadown/shared'
import { i18n } from '@/i18n'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { flushAllEditors } from '@/editor-registry'
import { saveCurrentSession } from '@/services/session'
import { useSettingsStore } from './settings'
import { useTabsStore } from './tabs'
import { useUiStore } from './ui'

const t = i18n.global.t

export const useUpdateStore = defineStore('update', () => {
  const settings = useSettingsStore()
  const tabs = useTabsStore()
  const ui = useUiStore()

  const snapshot = ref<UpdateSnapshot | null>(null)
  const installing = ref(false)
  const installBlocked = ref(false)

  let unsubscribe: (() => void) | null = null
  let autoInstall = false

  function subscribe(): void {
    if (unsubscribe) return
    unsubscribe = platform.onUpdateEvent((next) => {
      snapshot.value = next
      if (next.status === 'error') autoInstall = false
      if (next.status === 'downloaded' && autoInstall) void install()
    })
  }

  async function check(): Promise<void> {
    subscribe()
    ui.updateOpen = true
    installBlocked.value = false
    try {
      snapshot.value = await platform.checkForUpdate()
    } catch (error) {
      ui.toast('error', t('update.checkFailed'), describeError(error))
    }
  }

  async function download(): Promise<void> {
    if (!snapshot.value) return
    autoInstall = true
    installBlocked.value = false
    try {
      await platform.downloadUpdate()
    } catch {
      // The main process reports download failures through the update events.
    }
  }

  async function install(): Promise<boolean> {
    if (installing.value) return false
    installing.value = true
    try {
      flushAllEditors()
      if (!(await tabs.saveDirtyForUpdate())) {
        installBlocked.value = true
        autoInstall = false
        return false
      }
      await settings.flushAsync()
      await saveCurrentSession()
      installBlocked.value = false
      await platform.installUpdate()
      return true
    } catch (error) {
      autoInstall = false
      ui.toast('error', t('update.installFailed'), describeError(error))
      return false
    } finally {
      installing.value = false
    }
  }

  function openReleases(): void {
    const url = snapshot.value?.manualDownloadUrl
    if (!url) return
    void platform.openExternal(url).catch(() => undefined)
  }

  function dispose(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    snapshot,
    installing,
    installBlocked,
    check,
    download,
    install,
    openReleases,
    dispose,
  }
})
