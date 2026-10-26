import {
  DESKTOP_ASSET_SCHEME,
  DESKTOP_DOCUMENT_EVENTS_CHANNEL,
  DESKTOP_INVOKE_CHANNEL,
  DESKTOP_MENU_COMMAND_CHANNEL,
  DESKTOP_OPEN_FILES_CHANNEL,
  DESKTOP_TITLE_BAR_ARG,
  DESKTOP_WORKSPACE_EVENTS_CHANNEL,
  type DesktopBridge,
  type DesktopInvokeArgs,
  type DesktopInvokeMethod,
  type DesktopInvokeResult,
  type DocumentChangeEvent,
  type TitleBarMode,
  type WorkspaceEvent,
} from '@notadown/shared'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const titleBarModeArg = process.argv.find((arg) => arg.startsWith(DESKTOP_TITLE_BAR_ARG))
const titleBarMode: TitleBarMode =
  titleBarModeArg?.slice(DESKTOP_TITLE_BAR_ARG.length) === 'native'
    ? 'native'
    : 'integrated'

const bridge: DesktopBridge = {
  invoke<K extends DesktopInvokeMethod>(
    method: K,
    ...args: DesktopInvokeArgs<K>
  ): Promise<DesktopInvokeResult<K>> {
    return ipcRenderer.invoke(
      DESKTOP_INVOKE_CHANNEL,
      method,
      ...args,
    ) as Promise<DesktopInvokeResult<K>>
  },
  assetUrl(absolutePath: string): string {
    return `${DESKTOP_ASSET_SCHEME}://local/${encodeURIComponent(absolutePath)}`
  },
  getPathForFile(file: File): string | null {
    try {
      return webUtils.getPathForFile(file) || null
    } catch {
      return null
    }
  },
  onWorkspaceEvents(callback: (events: WorkspaceEvent[]) => void): () => void {
    const listener = (_event: unknown, events: WorkspaceEvent[]) => callback(events)
    ipcRenderer.on(DESKTOP_WORKSPACE_EVENTS_CHANNEL, listener)
    return () => ipcRenderer.removeListener(DESKTOP_WORKSPACE_EVENTS_CHANNEL, listener)
  },
  onDocumentEvents(
    callback: (events: DocumentChangeEvent[]) => void,
  ): () => void {
    const listener = (_event: unknown, events: DocumentChangeEvent[]) => callback(events)
    ipcRenderer.on(DESKTOP_DOCUMENT_EVENTS_CHANNEL, listener)
    return () => ipcRenderer.removeListener(DESKTOP_DOCUMENT_EVENTS_CHANNEL, listener)
  },
  onMenuCommand(callback: (command: string) => void): () => void {
    const listener = (_event: unknown, command: string) => callback(command)
    ipcRenderer.on(DESKTOP_MENU_COMMAND_CHANNEL, listener)
    return () => ipcRenderer.removeListener(DESKTOP_MENU_COMMAND_CHANNEL, listener)
  },
  onOpenFiles(callback: () => void): () => void {
    const listener = () => callback()
    ipcRenderer.on(DESKTOP_OPEN_FILES_CHANNEL, listener)
    return () => ipcRenderer.removeListener(DESKTOP_OPEN_FILES_CHANNEL, listener)
  },
  platform: process.platform,
  titleBarMode,
}

contextBridge.exposeInMainWorld('notadown', bridge)
