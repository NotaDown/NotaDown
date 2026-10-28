export type PlatformKind = 'desktop' | 'web'

export type ColorMode = 'system' | 'light' | 'dark'

export type TitleBarMode = 'integrated' | 'native'

export type PageWidthMode = 'very-narrow' | 'narrow' | 'default' | 'wide' | 'full'

export type UiDensity = 'compact' | 'default' | 'comfortable'

export type LocalePreference = 'system' | 'en-US' | 'zh-CN'

export type ThemeId = 'default' | 'paper' | 'nordic' | 'contrast'

export type SidebarView = 'files' | 'search' | 'outline' | 'history'

export type DocumentOrigin = 'workspace' | 'file' | 'untitled'

export type ImageStorageMode =
  | 'document-assets'
  | 'document-named'
  | 'global-attachments'
  | 'base64'

export type HistorySource = 'auto' | 'manual' | 'restore'

export interface PlatformCapabilities {
  folderWorkspace: boolean
  fileSystemWatching: boolean
  localHistory: boolean
  nativeDialogs: boolean
  pdfExport: boolean
  revealInFolder: boolean
  defaultAppSettings: boolean
}

export interface WorkspaceInfo {
  id: string
  name: string
  rootPath: string | null
}

export interface FileEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  size?: number
  modifiedAt?: number
}

export interface OpenWorkspaceResult {
  workspace: WorkspaceInfo
  entries: FileEntry[]
}

export interface DocumentRef {
  key: string
  name: string
  path: string | null
  origin: DocumentOrigin
}

export interface OpenedDocument {
  ref: DocumentRef
  content: string
  mtime: number | null
}

export interface DocumentStat {
  exists: boolean
  mtime: number | null
}

export interface SearchOptions {
  caseSensitive?: boolean
  limit?: number
}

export interface SearchResult {
  path: string
  name: string
  kind: 'name' | 'content' | 'both'
  line?: number
  preview?: string
  previewMatchStart?: number
  previewMatchLength?: number
}

export interface WorkspaceEvent {
  type: 'add' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  isDirectory: boolean
}

export interface DocumentChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
}

export interface OutlineItem {
  level: number
  text: string
  pos: number
}

export interface HistoryRecord {
  id: string
  documentKey: string
  filePath: string
  fileName: string
  createdAt: number
  source: HistorySource
  size: number
}

export interface HistoryDetail {
  record: HistoryRecord
  content: string
}

export interface HistoryOptions {
  maxPerFile: number
  retentionDays: number
}

export interface HistorySnapshotInput {
  documentKey: string
  filePath: string
  fileName: string
  content: string
  source: HistorySource
}

export interface ImageSaveResult {
  src: string
  displayUrl: string
  embedded: boolean
}

export interface AssetReadResult {
  data: Uint8Array
  mime: string
}

export interface SessionTab {
  key: string
  origin: DocumentOrigin
  path: string | null
  name: string
}

export interface SessionState {
  workspace: WorkspaceInfo | null
  tabs: SessionTab[]
  activeTabKey: string | null
  sidebarOpen: boolean
  sidebarView: SidebarView
}

export interface ToastMessage {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  detail?: string
  duration?: number
}
