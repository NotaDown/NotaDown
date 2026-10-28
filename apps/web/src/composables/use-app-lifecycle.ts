import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { SessionState } from '@notadown/shared'
import { platform } from '@/platform'
import { flushAllEditors, refreshEditors } from '@/editor-registry'
import { saveCurrentSession } from '@/services/session'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useUpdateStore } from '@/stores/update'
import { useWorkspaceStore } from '@/stores/workspace'
import { usesNativeTitleBar } from '@/window-chrome'
import type { AppCommands } from './use-app-commands'
import { maybePromptDefaultApp } from './use-default-app-guide'

export function useAppLifecycle(commands: AppCommands): void {
  const settings = useSettingsStore()
  const tabs = useTabsStore()
  const ui = useUiStore()
  const workspace = useWorkspaceStore()
  const update = useUpdateStore()

  const disposers: Array<() => void> = []
  let sessionTimer: number | null = null
  let historyTimer: number | null = null
  let resizeTimer: number | null = null

  onMounted(async () => {
    await settings.init()
    if (settings.settings.autoCheckUpdates) void update.checkSilently()

    disposers.push(platform.onMenuCommand((command) => void commands.run(command)))
    disposers.push(platform.onOpenFiles(() => void openPendingFiles()))
    disposers.push(
      workspace.subscribeEvents((events) => void tabs.handleWorkspaceEvents(events)),
    )

    await restoreSession()
    await openPendingFiles()
    maybePromptDefaultApp()

    historyTimer = window.setInterval(() => void tabs.tickHistory(), 20_000)

    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', persistSession)
    window.addEventListener('resize', onResize)

    updateTitle()
  })

  watch(
    () => [tabs.sessionTabs(), tabs.activeKey, ui.sidebarOpen, ui.sidebarView, workspace.info],
    () => scheduleSessionSave(),
    { deep: true },
  )

  watch(
    () => [
      tabs.activeTab?.name,
      tabs.activeTab ? tabs.isDirty(tabs.activeTab) : false,
      usesNativeTitleBar.value ? workspace.info?.name : null,
    ],
    () => updateTitle(),
  )

  async function openPendingFiles(): Promise<void> {
    const paths = await platform.takeOpenFiles()
    if (paths.length) await tabs.openAbsolutePaths(paths)
  }

  async function restoreSession(): Promise<void> {
    if (!settings.settings.restoreSession) return
    let session: SessionState | null = null
    try {
      session = await platform.loadSession()
    } catch {
      return
    }
    if (!session) return

    if (session.workspace) await workspace.restore(session.workspace)

    if (session.tabs?.length) {
      const mapping = await tabs.restoreSessionTabs(session.tabs)
      const active = session.activeTabKey ? mapping.get(session.activeTabKey) : undefined
      if (active) tabs.activeKey = active
    }

    ui.sidebarOpen = session.sidebarOpen
    ui.sidebarView = session.sidebarView
  }

  function scheduleSessionSave(): void {
    if (sessionTimer) window.clearTimeout(sessionTimer)
    sessionTimer = window.setTimeout(persistSession, 450)
  }

  function persistSession(): void {
    if (sessionTimer) {
      window.clearTimeout(sessionTimer)
      sessionTimer = null
    }
    settings.flush()
    void saveCurrentSession().catch(() => undefined)
  }

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    flushAllEditors()
    settings.flush()
    if (!tabs.hasDirty) return
    event.preventDefault()
    event.returnValue = ''
  }

  function onResize(): void {
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null
      refreshEditors()
    }, 150)
  }

  function updateTitle(): void {
    const workspaceName = usesNativeTitleBar.value ? workspace.info?.name : undefined
    const suffix = workspaceName ? `${workspaceName} — NotaDown` : 'NotaDown'
    const tab = tabs.activeTab
    if (!tab) {
      document.title = suffix
      return
    }
    const dirty = tabs.isDirty(tab) ? '• ' : ''
    document.title = `${dirty}${tab.name} — ${suffix}`
  }

  onBeforeUnmount(() => {
    if (sessionTimer) window.clearTimeout(sessionTimer)
    if (historyTimer) window.clearInterval(historyTimer)
    if (resizeTimer) window.clearTimeout(resizeTimer)
    for (const dispose of disposers) dispose()
    window.removeEventListener('beforeunload', onBeforeUnload)
    window.removeEventListener('pagehide', persistSession)
    window.removeEventListener('resize', onResize)
    tabs.dispose()
  })
}
