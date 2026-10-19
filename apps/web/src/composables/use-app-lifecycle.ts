import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { SessionState } from '@notadown/shared'
import { platform } from '@/platform'
import { refreshEditors } from '@/editor-registry'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import type { AppCommands } from './use-app-commands'

export function useAppLifecycle(commands: AppCommands): void {
  const settings = useSettingsStore()
  const tabs = useTabsStore()
  const ui = useUiStore()
  const workspace = useWorkspaceStore()

  const disposers: Array<() => void> = []
  let sessionTimer: number | null = null
  let historyTimer: number | null = null
  let resizeTimer: number | null = null

  onMounted(async () => {
    await settings.init()

    disposers.push(platform.onMenuCommand((command) => void commands.run(command)))
    disposers.push(
      workspace.subscribeEvents((events) => void tabs.handleWorkspaceEvents(events)),
    )

    await restoreSession()

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
    () => [tabs.activeTab?.name, tabs.activeTab ? tabs.isDirty(tabs.activeTab) : false],
    () => updateTitle(),
  )

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

  function sessionState(): SessionState {
    return {
      workspace: workspace.info,
      tabs: tabs.sessionTabs(),
      activeTabKey: tabs.activeKey,
      sidebarOpen: ui.sidebarOpen,
      sidebarView: ui.sidebarView,
    }
  }

  function persistSession(): void {
    if (sessionTimer) {
      window.clearTimeout(sessionTimer)
      sessionTimer = null
    }
    settings.flush()
    // Reactive proxies are not structured-cloneable for IndexedDB/IPC.
    const session = JSON.parse(JSON.stringify(sessionState())) as SessionState
    void platform.saveSession(session).catch(() => undefined)
  }

  function onBeforeUnload(event: BeforeUnloadEvent): void {
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
    const tab = tabs.activeTab
    if (!tab) {
      document.title = 'NotaDown'
      return
    }
    const dirty = tabs.isDirty(tab) ? '• ' : ''
    document.title = `${dirty}${tab.name} — NotaDown`
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
