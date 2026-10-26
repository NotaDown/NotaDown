import type { SessionState } from '@notadown/shared'
import { platform } from '@/platform'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

export function currentSessionState(): SessionState {
  const tabs = useTabsStore()
  const ui = useUiStore()
  const workspace = useWorkspaceStore()
  return {
    workspace: workspace.info,
    tabs: tabs.sessionTabs(),
    activeTabKey: tabs.activeKey,
    sidebarOpen: ui.sidebarOpen,
    sidebarView: ui.sidebarView,
  }
}

export async function saveCurrentSession(): Promise<void> {
  // Reactive proxies are not structured-cloneable for IndexedDB/IPC.
  const session = JSON.parse(JSON.stringify(currentSessionState())) as SessionState
  await platform.saveSession(session)
}
