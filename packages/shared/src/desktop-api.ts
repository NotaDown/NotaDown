import type { AppSettings } from './settings'
import type {
  AssetReadResult,
  DocumentChangeEvent,
  DocumentRef,
  DocumentStat,
  FileEntry,
  HistoryDetail,
  HistoryOptions,
  HistoryRecord,
  HistorySnapshotInput,
  OpenWorkspaceResult,
  OpenedDocument,
  SearchOptions,
  SearchResult,
  SessionState,
  TitleBarMode,
  WorkspaceEvent,
} from './types'

export interface DesktopInvokeMap {
  getVersion: { args: []; result: string }
  getPlatform: { args: []; result: string }
  openWorkspace: { args: []; result: OpenWorkspaceResult | null }
  restoreWorkspace: { args: [rootPath: string]; result: OpenWorkspaceResult | null }
  closeWorkspace: { args: []; result: void }
  listWorkspaceDirectory: { args: [relativePath: string]; result: FileEntry[] }
  findWorkspaceFiles: { args: [query: string, limit: number]; result: FileEntry[] }
  setWatchDirectories: { args: [relativePaths: string[]]; result: void }
  readWorkspaceFile: {
    args: [relativePath: string]
    result: { content: string; mtime: number }
  }
  writeWorkspaceFile: {
    args: [relativePath: string, content: string]
    result: { mtime: number }
  }
  createWorkspaceFile: {
    args: [relativePath: string, content: string]
    result: void
  }
  createWorkspaceDirectory: { args: [relativePath: string]; result: void }
  renameWorkspaceEntry: {
    args: [relativePath: string, nextRelativePath: string]
    result: void
  }
  copyWorkspaceEntry: {
    args: [relativePath: string, nextRelativePath: string]
    result: void
  }
  moveWorkspaceEntry: {
    args: [relativePath: string, destinationDir: string]
    result: void
  }
  deleteWorkspaceEntry: { args: [relativePath: string]; result: void }
  revealWorkspaceEntry: { args: [relativePath: string]; result: void }
  openFileDialog: { args: []; result: OpenedDocument | null }
  readFile: {
    args: [absolutePath: string]
    result: { content: string; mtime: number }
  }
  writeFile: {
    args: [absolutePath: string, content: string]
    result: { mtime: number }
  }
  saveFileDialog: {
    args: [suggestedName: string, content: string, defaultDirectory: string | null]
    result: DocumentRef | null
  }
  statFile: { args: [absolutePath: string]; result: DocumentStat }
  writeImageFile: {
    args: [absolutePath: string, data: Uint8Array, mime: string]
    result: void
  }
  readAsset: { args: [absolutePath: string]; result: AssetReadResult | null }
  searchWorkspace: {
    args: [query: string, options?: SearchOptions]
    result: SearchResult[]
  }
  startWatch: { args: []; result: void }
  startFileWatch: { args: [absolutePath: string]; result: void }
  stopFileWatch: { args: [absolutePath: string]; result: void }
  historySnapshot: {
    args: [input: HistorySnapshotInput, options: HistoryOptions]
    result: HistoryRecord
  }
  historyList: { args: [documentKey?: string]; result: HistoryRecord[] }
  historyRead: { args: [id: string]; result: HistoryDetail | null }
  historyDelete: { args: [id: string]; result: void }
  historyClear: { args: []; result: void }
  loadSettings: { args: []; result: Partial<AppSettings> | null }
  saveSettings: { args: [settings: AppSettings]; result: void }
  loadSession: { args: []; result: SessionState | null }
  saveSession: { args: [session: SessionState]; result: void }
  recreateWindow: { args: []; result: void }
  exportHtml: { args: [html: string, suggestedName: string]; result: boolean }
  exportPdf: { args: [html: string, suggestedName: string]; result: boolean }
  setTitleBarOverlay: { args: [color: string, symbolColor: string]; result: void }
  openExternal: { args: [url: string]; result: void }
  openDefaultAppSettings: { args: []; result: void }
  takeOpenFiles: { args: []; result: string[] }
}

export type DesktopInvokeMethod = keyof DesktopInvokeMap

export type DesktopInvokeArgs<K extends DesktopInvokeMethod> = DesktopInvokeMap[K]['args']
export type DesktopInvokeResult<K extends DesktopInvokeMethod> = DesktopInvokeMap[K]['result']

export interface DesktopBridge {
  invoke<K extends DesktopInvokeMethod>(
    method: K,
    ...args: DesktopInvokeArgs<K>
  ): Promise<DesktopInvokeResult<K>>
  assetUrl(absolutePath: string): string
  getPathForFile(file: File): string | null
  onWorkspaceEvents(callback: (events: WorkspaceEvent[]) => void): () => void
  onDocumentEvents(callback: (events: DocumentChangeEvent[]) => void): () => void
  onMenuCommand(callback: (command: string) => void): () => void
  onOpenFiles(callback: () => void): () => void
  platform: string
  titleBarMode: TitleBarMode
}

export const DESKTOP_TITLE_BAR_ARG = '--notadown-title-bar='
export const DESKTOP_INVOKE_CHANNEL = 'notadown:invoke'
export const DESKTOP_WORKSPACE_EVENTS_CHANNEL = 'notadown:workspace-events'
export const DESKTOP_DOCUMENT_EVENTS_CHANNEL = 'notadown:document-events'
export const DESKTOP_MENU_COMMAND_CHANNEL = 'notadown:menu-command'
export const DESKTOP_OPEN_FILES_CHANNEL = 'notadown:open-files'
export const DESKTOP_ASSET_SCHEME = 'notadown-asset'

declare global {
  interface Window {
    notadown?: DesktopBridge
  }
}
