import type {
  AppSettings,
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
  PlatformCapabilities,
  PlatformKind,
  SearchOptions,
  SearchResult,
  SessionState,
  UpdateSnapshot,
  WorkspaceEvent,
  WorkspaceInfo,
} from '@notadown/shared'

export interface DocumentWriteResult {
  mtime: number | null
  mode: 'saved' | 'downloaded'
}

export interface AssetTarget {
  scope: 'workspace' | 'absolute'
  path: string
}

export interface Platform {
  readonly kind: PlatformKind
  readonly capabilities: PlatformCapabilities
  readonly version: string

  getVersion(): Promise<string>
  openWorkspace(): Promise<OpenWorkspaceResult | null>
  restoreWorkspace(info: WorkspaceInfo): Promise<OpenWorkspaceResult | null>
  closeWorkspace(): Promise<void>
  getWorkspace(): WorkspaceInfo | null
  listWorkspaceDirectory(path: string): Promise<FileEntry[]>
  findWorkspaceFiles(query: string, limit?: number): Promise<FileEntry[]>
  createWorkspaceFile(path: string, content: string): Promise<void>
  createWorkspaceDirectory(path: string): Promise<void>
  renameWorkspaceEntry(path: string, nextPath: string): Promise<void>
  copyWorkspaceEntry(path: string, nextPath: string): Promise<void>
  moveWorkspaceEntry(path: string, destinationDir: string): Promise<void>
  deleteWorkspaceEntry(path: string, isDirectory: boolean): Promise<void>
  revealWorkspaceEntry(path: string): Promise<void>
  workspaceDocumentRef(path: string): DocumentRef
  workspaceAbsolutePath(path: string): string | null

  openFileDialog(): Promise<OpenedDocument | null>
  openDroppedFile(file: File): Promise<OpenedDocument | null>
  openDroppedFolder(file: File): Promise<OpenWorkspaceResult | null>
  documentRefForPath(absolutePath: string): DocumentRef
  takeOpenFiles(): Promise<string[]>
  readDocument(ref: DocumentRef): Promise<OpenedDocument>
  writeDocument(ref: DocumentRef, content: string): Promise<DocumentWriteResult>
  saveDocumentAs(
    ref: DocumentRef | null,
    content: string,
    suggestedName: string,
  ): Promise<DocumentRef | null>
  statDocument(ref: DocumentRef): Promise<DocumentStat>

  writeAsset(target: AssetTarget, data: Uint8Array, mime: string): Promise<void>
  readAsset(target: AssetTarget): Promise<AssetReadResult | null>
  getAssetUrl(target: AssetTarget): Promise<string>

  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  watchWorkspace(onEvents: (events: WorkspaceEvent[]) => void): () => void
  setWorkspaceWatchDirectories(paths: string[]): void
  watchDocument(
    path: string,
    onEvent: (event: DocumentChangeEvent) => void,
  ): () => void

  saveHistory(input: HistorySnapshotInput, options: HistoryOptions): Promise<HistoryRecord>
  listHistory(documentKey?: string): Promise<HistoryRecord[]>
  readHistory(id: string): Promise<HistoryDetail | null>
  deleteHistory(id: string): Promise<void>
  clearHistory(): Promise<void>

  loadSettings(): Promise<Partial<AppSettings> | null>
  saveSettings(settings: AppSettings): Promise<void>
  loadSession(): Promise<SessionState | null>
  saveSession(session: SessionState): Promise<void>

  exportHtml(html: string, fileName: string): Promise<boolean>
  exportPdf(html: string, fileName: string): Promise<boolean>
  openExternal(url: string): Promise<void>
  openDefaultAppSettings(): Promise<void>
  getPathForFile(file: File): string | null
  onMenuCommand(callback: (command: string) => void): () => void
  onOpenFiles(callback: () => void): () => void
  checkForUpdate(): Promise<UpdateSnapshot>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateEvent(callback: (snapshot: UpdateSnapshot) => void): () => void
}
