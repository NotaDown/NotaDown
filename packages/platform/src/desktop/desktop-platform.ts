import {
  basename,
  fileDocumentRef,
  isOpenableTextFile,
  normalizeSlashes,
  type AppSettings,
  type AssetReadResult,
  type DesktopBridge,
  type DocumentChangeEvent,
  type DocumentRef,
  type DocumentStat,
  type FileEntry,
  type HistoryDetail,
  type HistoryOptions,
  type HistoryRecord,
  type HistorySnapshotInput,
  type OpenWorkspaceResult,
  type OpenedDocument,
  type PlatformCapabilities,
  type SearchOptions,
  type SearchResult,
  type SessionState,
  type WorkspaceEvent,
  type WorkspaceInfo,
} from '@notadown/shared'
import type { AssetTarget, DocumentWriteResult, Platform } from '../types'

export class DesktopPlatform implements Platform {
  readonly kind = 'desktop' as const
  readonly capabilities: PlatformCapabilities
  readonly version: string

  private readonly bridge: DesktopBridge
  private workspace: WorkspaceInfo | null = null

  constructor(bridge: DesktopBridge, version: string) {
    this.bridge = bridge
    this.version = version
    this.capabilities = {
      folderWorkspace: true,
      fileSystemWatching: true,
      localHistory: true,
      nativeDialogs: true,
      pdfExport: true,
      revealInFolder: true,
      defaultAppSettings: bridge.platform === 'win32',
    }
  }

  async getVersion(): Promise<string> {
    return this.version
  }

  async openWorkspace(): Promise<OpenWorkspaceResult | null> {
    const result = await this.bridge.invoke('openWorkspace')
    if (result) this.workspace = result.workspace
    return result
  }

  async restoreWorkspace(info: WorkspaceInfo): Promise<OpenWorkspaceResult | null> {
    return this.attachWorkspace(info.rootPath)
  }

  async openDroppedFolder(file: File): Promise<OpenWorkspaceResult | null> {
    return this.attachWorkspace(this.bridge.getPathForFile(file))
  }

  private async attachWorkspace(directory: string | null): Promise<OpenWorkspaceResult | null> {
    if (!directory) return null
    const result = await this.bridge.invoke('restoreWorkspace', directory)
    if (result) this.workspace = result.workspace
    return result
  }

  async closeWorkspace(): Promise<void> {
    this.workspace = null
    await this.bridge.invoke('closeWorkspace')
  }

  getWorkspace(): WorkspaceInfo | null {
    return this.workspace
  }

  async listWorkspace(): Promise<FileEntry[]> {
    return this.bridge.invoke('listWorkspace')
  }

  workspaceDocumentRef(path: string): DocumentRef {
    const workspace = this.workspace
    if (!workspace) throw new Error('NO_WORKSPACE')
    const relative = normalizeSlashes(path).replace(/^\/+/, '')
    const rootKey = normalizeSlashes(workspace.rootPath ?? workspace.id).replace(/\/+$/, '')
    return {
      key: `workspace:${rootKey}/${relative}`,
      name: basename(relative),
      path: relative,
      origin: 'workspace',
    }
  }

  async createWorkspaceFile(path: string, content: string): Promise<void> {
    await this.bridge.invoke('createWorkspaceFile', path, content)
  }

  async createWorkspaceDirectory(path: string): Promise<void> {
    await this.bridge.invoke('createWorkspaceDirectory', path)
  }

  async renameWorkspaceEntry(path: string, nextPath: string): Promise<void> {
    await this.bridge.invoke('renameWorkspaceEntry', path, nextPath)
  }

  async copyWorkspaceEntry(path: string, nextPath: string): Promise<void> {
    await this.bridge.invoke('copyWorkspaceEntry', path, nextPath)
  }

  async moveWorkspaceEntry(path: string, destinationDir: string): Promise<void> {
    await this.bridge.invoke('moveWorkspaceEntry', path, destinationDir)
  }

  async deleteWorkspaceEntry(path: string): Promise<void> {
    await this.bridge.invoke('deleteWorkspaceEntry', path)
  }

  async revealWorkspaceEntry(path: string): Promise<void> {
    await this.bridge.invoke('revealWorkspaceEntry', path)
  }

  async openFileDialog(): Promise<OpenedDocument | null> {
    return this.bridge.invoke('openFileDialog')
  }

  async openDroppedFile(file: File): Promise<OpenedDocument | null> {
    if (!isOpenableTextFile(file.name)) return null
    const absolutePath = this.bridge.getPathForFile(file)
    if (!absolutePath) return null
    return this.readDocument(this.documentRefForPath(absolutePath))
  }

  documentRefForPath(absolutePath: string): DocumentRef {
    const root = this.workspace?.rootPath
    if (root) {
      const normalizedRoot = normalizeSlashes(root).replace(/\/+$/, '')
      const normalizedPath = normalizeSlashes(absolutePath)
      const prefix = `${normalizedRoot}/`
      const inside = /^[a-zA-Z]:\//.test(normalizedRoot)
        ? normalizedPath.toLowerCase().startsWith(prefix.toLowerCase())
        : normalizedPath.startsWith(prefix)
      if (inside) return this.workspaceDocumentRef(normalizedPath.slice(prefix.length))
    }
    return fileDocumentRef(absolutePath)
  }

  async takeOpenFiles(): Promise<string[]> {
    return this.bridge.invoke('takeOpenFiles')
  }

  async readDocument(ref: DocumentRef): Promise<OpenedDocument> {
    if (ref.origin === 'workspace') {
      const result = await this.bridge.invoke('readWorkspaceFile', this.requireWorkspacePath(ref))
      return { ref, content: result.content, mtime: result.mtime }
    }
    if (ref.origin === 'file') {
      const result = await this.bridge.invoke('readFile', this.requireAbsolutePath(ref))
      return { ref, content: result.content, mtime: result.mtime }
    }
    throw new Error('UNSUPPORTED')
  }

  async writeDocument(ref: DocumentRef, content: string): Promise<DocumentWriteResult> {
    if (ref.origin === 'workspace') {
      const result = await this.bridge.invoke(
        'writeWorkspaceFile',
        this.requireWorkspacePath(ref),
        content,
      )
      return { mtime: result.mtime, mode: 'saved' }
    }
    if (ref.origin === 'file') {
      const result = await this.bridge.invoke('writeFile', this.requireAbsolutePath(ref), content)
      return { mtime: result.mtime, mode: 'saved' }
    }
    throw new Error('UNSUPPORTED')
  }

  async saveDocumentAs(
    ref: DocumentRef | null,
    content: string,
    suggestedName: string,
  ): Promise<DocumentRef | null> {
    const defaultDirectory = this.defaultSaveDirectory(ref)
    return this.bridge.invoke('saveFileDialog', suggestedName, content, defaultDirectory)
  }

  async statDocument(ref: DocumentRef): Promise<DocumentStat> {
    if (ref.origin === 'workspace') {
      try {
        const result = await this.bridge.invoke(
          'readWorkspaceFile',
          this.requireWorkspacePath(ref),
        )
        return { exists: true, mtime: result.mtime }
      } catch {
        return { exists: false, mtime: null }
      }
    }
    if (ref.origin === 'file') {
      if (!ref.path) return { exists: false, mtime: null }
      return this.bridge.invoke('statFile', ref.path)
    }
    return { exists: true, mtime: null }
  }

  async writeAsset(target: AssetTarget, data: Uint8Array, mime: string): Promise<void> {
    await this.bridge.invoke('writeImageFile', this.assetPath(target), data, mime)
  }

  async readAsset(target: AssetTarget): Promise<AssetReadResult | null> {
    return this.bridge.invoke('readAsset', this.assetPath(target))
  }

  async getAssetUrl(target: AssetTarget): Promise<string> {
    return this.bridge.assetUrl(this.assetPath(target))
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.bridge.invoke('searchWorkspace', query, options)
  }

  watchWorkspace(onEvents: (events: WorkspaceEvent[]) => void): () => void {
    const unsubscribe = this.bridge.onWorkspaceEvents(onEvents)
    void this.bridge.invoke('startWatch').catch(() => undefined)
    return unsubscribe
  }

  watchDocument(
    path: string,
    onEvent: (event: DocumentChangeEvent) => void,
  ): () => void {
    const target = normalizeSlashes(path)
    const caseInsensitive = this.bridge.platform === 'win32'
    const unsubscribe = this.bridge.onDocumentEvents((events) => {
      for (const event of events) {
        const candidate = normalizeSlashes(event.path)
        const matches = caseInsensitive
          ? candidate.toLowerCase() === target.toLowerCase()
          : candidate === target
        if (matches) onEvent(event)
      }
    })
    void this.bridge.invoke('startFileWatch', path).catch(() => undefined)
    return () => {
      unsubscribe()
      void this.bridge.invoke('stopFileWatch', path).catch(() => undefined)
    }
  }

  async saveHistory(
    input: HistorySnapshotInput,
    options: HistoryOptions,
  ): Promise<HistoryRecord> {
    return this.bridge.invoke('historySnapshot', input, options)
  }

  async listHistory(documentKey?: string): Promise<HistoryRecord[]> {
    return this.bridge.invoke('historyList', documentKey)
  }

  async readHistory(id: string): Promise<HistoryDetail | null> {
    return this.bridge.invoke('historyRead', id)
  }

  async deleteHistory(id: string): Promise<void> {
    await this.bridge.invoke('historyDelete', id)
  }

  async clearHistory(): Promise<void> {
    await this.bridge.invoke('historyClear')
  }

  async loadSettings(): Promise<Partial<AppSettings> | null> {
    return this.bridge.invoke('loadSettings')
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.bridge.invoke('saveSettings', settings)
  }

  async loadSession(): Promise<SessionState | null> {
    return this.bridge.invoke('loadSession')
  }

  async saveSession(session: SessionState): Promise<void> {
    await this.bridge.invoke('saveSession', session)
  }

  async exportHtml(html: string, fileName: string): Promise<boolean> {
    return this.bridge.invoke('exportHtml', html, fileName)
  }

  async exportPdf(html: string, fileName: string): Promise<boolean> {
    return this.bridge.invoke('exportPdf', html, fileName)
  }

  async openExternal(url: string): Promise<void> {
    if (!/^(https?:|mailto:)/i.test(url)) throw new Error('UNSUPPORTED')
    await this.bridge.invoke('openExternal', url)
  }

  async openDefaultAppSettings(): Promise<void> {
    await this.bridge.invoke('openDefaultAppSettings')
  }

  getPathForFile(file: File): string | null {
    return this.bridge.getPathForFile(file)
  }

  onMenuCommand(callback: (command: string) => void): () => void {
    return this.bridge.onMenuCommand(callback)
  }

  onOpenFiles(callback: () => void): () => void {
    return this.bridge.onOpenFiles(callback)
  }

  private requireWorkspacePath(ref: DocumentRef): string {
    if (!ref.path) throw new Error('INVALID_PATH')
    return normalizeSlashes(ref.path)
  }

  private requireAbsolutePath(ref: DocumentRef): string {
    if (!ref.path) throw new Error('INVALID_PATH')
    return ref.path
  }

  private assetPath(target: AssetTarget): string {
    if (target.scope === 'absolute') return target.path
    const workspace = this.workspace
    if (!workspace?.rootPath) throw new Error('NO_WORKSPACE')
    return joinAbsolute(workspace.rootPath, target.path)
  }

  private defaultSaveDirectory(ref: DocumentRef | null): string | null {
    if (ref?.origin === 'workspace') return this.workspace?.rootPath ?? null
    if (ref?.path) {
      const directory = absoluteDirname(ref.path)
      return directory || null
    }
    return this.workspace?.rootPath ?? null
  }
}

function joinAbsolute(base: string, relative: string): string {
  const cleanBase = base.replace(/[\\/]+$/, '')
  const normalizedRelative = normalizeSlashes(relative).replace(/^\/+/, '')
  if (cleanBase.includes('\\')) return `${cleanBase}\\${normalizedRelative.replace(/\//g, '\\')}`
  return `${cleanBase}/${normalizedRelative}`
}

function absoluteDirname(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (index <= 0) return ''
  return path.slice(0, index)
}
