import {
  basename,
  createId,
  ensureMarkdownExtension,
  isOpenableTextFile,
  mimeFromFileName,
  normalizeSlashes,
  searchText,
  type AppSettings,
  type AssetReadResult,
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
  type WorkspaceInfo,
} from '@notadown/shared'
import type { AssetTarget, DocumentWriteResult, Platform } from '../types'
import {
  downloadBlob,
  downloadHtml,
  ensurePermission,
  entryExists,
  fsaWindow,
  getParentDirectory,
  copyDirectory,
  moveHandle,
  pathSegments,
  printHtml,
  resolveDirectory,
  resolveFile,
  supportsDirectoryPicker,
  supportsFilePicker,
  walkDirectory,
  writeFileHandle,
  type FsDirectoryHandle,
  type FsFileHandle,
} from './fsa'
import { getDb, kvGet, kvSet } from './idb'

interface StoredWorkspace {
  info: WorkspaceInfo
  handle: FsDirectoryHandle
}

const LEGACY_WORKSPACE_KEY = 'workspace'
const WORKSPACES_KEY = 'workspaces'
const MAX_STORED_WORKSPACES = 12

interface MemoryFile {
  name: string
  content: string
  mtime: number
}

const TEXT_FILE_TYPES = [
  {
    description: 'Markdown and text',
    accept: {
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt', '.mdown', '.mkd'],
    },
  },
]

export class WebPlatform implements Platform {
  readonly kind = 'web' as const
  readonly capabilities: PlatformCapabilities
  readonly version: string

  private workspace: WorkspaceInfo | null = null
  private rootHandle: FsDirectoryHandle | null = null
  private readonly fileHandles = new Map<string, FsFileHandle>()
  private readonly memoryFiles = new Map<string, MemoryFile>()
  private readonly assetUrls = new Map<string, string>()

  constructor(version: string) {
    this.version = version
    this.capabilities = {
      folderWorkspace: supportsDirectoryPicker(),
      fileSystemWatching: false,
      localHistory: true,
      nativeDialogs: supportsFilePicker(),
      pdfExport: true,
      revealInFolder: false,
    }
  }

  async getVersion(): Promise<string> {
    return this.version
  }

  async openWorkspace(): Promise<OpenWorkspaceResult | null> {
    const picker = fsaWindow().showDirectoryPicker
    if (!picker) throw new Error('UNSUPPORTED')
    const handle = await picker({ id: 'notadown-workspace', mode: 'readwrite' })
    if (!(await ensurePermission(handle))) throw new Error('PERMISSION_DENIED')

    const stored = await this.storedWorkspaces()
    const existing = await this.findStoredWorkspace(handle, stored)
    const info: WorkspaceInfo = existing?.info ?? {
      id: createId('webws'),
      name: handle.name,
      rootPath: null,
    }
    this.workspace = info
    this.rootHandle = handle
    await this.persistWorkspace({ info, handle }, stored)
    return { workspace: info, entries: await this.listWorkspace() }
  }

  async restoreWorkspace(info: WorkspaceInfo): Promise<OpenWorkspaceResult | null> {
    const stored = await this.storedWorkspaces()
    const match = stored.find((item) => item.info.id === info.id)
    if (!match) return null
    const granted = await ensurePermission(match.handle)
    if (!granted) return null
    this.workspace = match.info
    this.rootHandle = match.handle
    await this.persistWorkspace(match, stored)
    return { workspace: match.info, entries: await this.listWorkspace() }
  }

  async closeWorkspace(): Promise<void> {
    for (const url of this.assetUrls.values()) URL.revokeObjectURL(url)
    this.assetUrls.clear()
    this.workspace = null
    this.rootHandle = null
  }

  getWorkspace(): WorkspaceInfo | null {
    return this.workspace
  }

  async listWorkspace(): Promise<FileEntry[]> {
    const root = this.requireRoot()
    const entries: FileEntry[] = []
    for await (const entry of walkDirectory(root)) {
      entries.push({ path: entry.path, name: entry.name, kind: entry.kind })
    }
    return entries
  }

  workspaceDocumentRef(path: string): DocumentRef {
    const workspace = this.workspace
    if (!workspace) throw new Error('NO_WORKSPACE')
    const normalized = normalizeSlashes(path)
    return {
      key: `${workspace.id}/${normalized}`,
      name: basename(normalized),
      path: normalized,
      origin: 'workspace',
    }
  }

  async createWorkspaceFile(path: string, content: string): Promise<void> {
    const root = this.requireRoot()
    if (await entryExists(root, path)) throw new Error('ALREADY_EXISTS')
    const handle = await resolveFile(root, path, true)
    await writeFileHandle(handle, content)
  }

  async createWorkspaceDirectory(path: string): Promise<void> {
    const root = this.requireRoot()
    if (await entryExists(root, path)) throw new Error('ALREADY_EXISTS')
    const segments = pathSegments(path)
    await resolveDirectory(root, segments, true)
  }

  async renameWorkspaceEntry(path: string, nextPath: string): Promise<void> {
    const root = this.requireRoot()
    if (path === nextPath) return
    if (await entryExists(root, nextPath)) throw new Error('ALREADY_EXISTS')
    const { parent: sourceParent, name: sourceName } = await getParentDirectory(root, path)
    const sourceHandle = await this.resolveEntry(sourceParent, sourceName)
    const { parent: destinationParent, name: nextName } = await getParentDirectory(root, nextPath)
    await moveHandle(sourceHandle, sourceParent, sourceName, destinationParent, nextName)
  }

  async copyWorkspaceEntry(path: string, nextPath: string): Promise<void> {
    const root = this.requireRoot()
    if (path === nextPath) return
    if (await entryExists(root, nextPath)) throw new Error('ALREADY_EXISTS')
    const { parent: sourceParent, name: sourceName } = await getParentDirectory(root, path)
    const sourceHandle = await this.resolveEntry(sourceParent, sourceName)
    const { parent: destinationParent, name: nextName } = await getParentDirectory(root, nextPath)
    if (sourceHandle.kind === 'file') {
      const file = await (sourceHandle as FsFileHandle).getFile()
      const target = await destinationParent.getFileHandle(nextName, { create: true })
      await writeFileHandle(target, await file.arrayBuffer())
      return
    }
    const targetDir = await destinationParent.getDirectoryHandle(nextName, { create: true })
    await copyDirectory(sourceHandle as FsDirectoryHandle, targetDir)
  }

  async moveWorkspaceEntry(path: string, destinationDir: string): Promise<void> {
    const root = this.requireRoot()
    const destination = normalizeSlashes(destinationDir)
    const currentDir = normalizeSlashes(path).split('/').slice(0, -1).join('/')
    if (currentDir === destination) return
    const { parent: sourceParent, name: sourceName } = await getParentDirectory(root, path)
    const destinationParent = await resolveDirectory(
      root,
      destination ? pathSegments(destination) : [],
      false,
    )
    const nextPath = destination ? `${destination}/${sourceName}` : sourceName
    if (await entryExists(root, nextPath)) throw new Error('ALREADY_EXISTS')
    const sourceHandle = await this.resolveEntry(sourceParent, sourceName)
    await moveHandle(sourceHandle, sourceParent, sourceName, destinationParent, sourceName)
  }

  async deleteWorkspaceEntry(path: string): Promise<void> {
    const root = this.requireRoot()
    const { parent, name } = await getParentDirectory(root, path)
    await parent.removeEntry(name, { recursive: true })
  }

  async revealWorkspaceEntry(): Promise<void> {
    throw new Error('UNSUPPORTED')
  }

  async openFileDialog(): Promise<OpenedDocument | null> {
    if (supportsFilePicker()) {
      const picker = fsaWindow().showOpenFilePicker
      if (!picker) return null
      let handles: FsFileHandle[]
      try {
        handles = await picker({ multiple: false, types: TEXT_FILE_TYPES })
      } catch (error) {
        if (isAbortError(error)) return null
        throw error
      }
      const handle = handles[0]
      if (!handle) return null
      if (!(await ensurePermission(handle, 'readwrite'))) throw new Error('PERMISSION_DENIED')
      const file = await handle.getFile()
      const content = await file.text()
      const key = (await this.findHandleKey(handle)) ?? createId('webfile')
      this.fileHandles.set(key, handle)
      await kvSet(`file:${key}`, handle)
      return {
        ref: { key, name: file.name, path: file.name, origin: 'file' },
        content,
        mtime: file.lastModified,
      }
    }

    return new Promise<OpenedDocument | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.mdown,.mkd,.txt'
      input.style.display = 'none'
      let settled = false
      const finish = (value: OpenedDocument | null) => {
        if (settled) return
        settled = true
        input.remove()
        resolve(value)
      }
      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        if (!file) {
          finish(null)
          return
        }
        const content = await file.text()
        const key = this.findMemoryFileKey(file.name, content) ?? createId('webfile')
        this.memoryFiles.set(key, { name: file.name, content, mtime: file.lastModified })
        finish({
          ref: { key, name: file.name, path: file.name, origin: 'file' },
          content,
          mtime: file.lastModified,
        })
      })
      input.addEventListener('cancel', () => finish(null))
      document.body.appendChild(input)
      input.click()
    })
  }

  async openDroppedFile(file: File): Promise<OpenedDocument | null> {
    if (!isOpenableTextFile(file.name)) return null
    const content = await file.text()
    const key = this.findMemoryFileKey(file.name, content) ?? createId('webfile')
    this.memoryFiles.set(key, { name: file.name, content, mtime: file.lastModified })
    return {
      ref: { key, name: file.name, path: file.name, origin: 'file' },
      content,
      mtime: file.lastModified,
    }
  }

  async openDroppedFolder(): Promise<OpenWorkspaceResult | null> {
    return null
  }

  documentRefForPath(): DocumentRef {
    throw new Error('UNSUPPORTED')
  }

  async takeOpenFiles(): Promise<string[]> {
    return []
  }

  async readDocument(ref: DocumentRef): Promise<OpenedDocument> {
    if (ref.origin === 'workspace') {
      const root = this.requireRoot()
      const fileHandle = await resolveFile(root, this.requireWorkspacePath(ref))
      const file = await fileHandle.getFile()
      return { ref, content: await file.text(), mtime: file.lastModified }
    }
    if (ref.origin === 'file') {
      const handle = await this.getFileHandle(ref.key)
      if (handle) {
        const file = await handle.getFile()
        return { ref, content: await file.text(), mtime: file.lastModified }
      }
      const memory = this.memoryFiles.get(ref.key)
      if (!memory) throw new Error('NOT_FOUND')
      return { ref, content: memory.content, mtime: memory.mtime }
    }
    throw new Error('UNSUPPORTED')
  }

  async writeDocument(ref: DocumentRef, content: string): Promise<DocumentWriteResult> {
    if (ref.origin === 'workspace') {
      const root = this.requireRoot()
      const handle = await resolveFile(root, this.requireWorkspacePath(ref), true)
      await writeFileHandle(handle, content)
      const file = await handle.getFile()
      return { mtime: file.lastModified, mode: 'saved' }
    }

    if (ref.origin === 'file') {
      const handle = await this.getFileHandle(ref.key)
      if (handle) {
        if (!(await ensurePermission(handle, 'readwrite'))) throw new Error('PERMISSION_DENIED')
        await writeFileHandle(handle, content)
        const file = await handle.getFile()
        return { mtime: file.lastModified, mode: 'saved' }
      }
      const name = ref.name || 'Untitled.md'
      downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), name)
      this.memoryFiles.set(ref.key, { name, content, mtime: Date.now() })
      return { mtime: Date.now(), mode: 'downloaded' }
    }

    const name = ref.name || 'Untitled.md'
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), name)
    return { mtime: Date.now(), mode: 'downloaded' }
  }

  async saveDocumentAs(
    ref: DocumentRef | null,
    content: string,
    suggestedName: string,
  ): Promise<DocumentRef | null> {
    const name = ensureMarkdownExtension(suggestedName || ref?.name || 'Untitled')
    const picker = fsaWindow().showSaveFilePicker
    if (picker) {
      let handle: FsFileHandle
      try {
        handle = await picker({ suggestedName: name, types: TEXT_FILE_TYPES })
      } catch (error) {
        if (isAbortError(error)) return null
        throw error
      }
      if (!(await ensurePermission(handle, 'readwrite'))) throw new Error('PERMISSION_DENIED')
      await writeFileHandle(handle, content)
      const key = createId('webfile')
      this.fileHandles.set(key, handle)
      await kvSet(`file:${key}`, handle)
      const fileName = handle.name || name
      return { key, name: fileName, path: fileName, origin: 'file' }
    }

    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), name)
    const key = ref?.key ?? createId('webfile')
    this.memoryFiles.set(key, { name, content, mtime: Date.now() })
    return { key, name, path: name, origin: 'file' }
  }

  async statDocument(ref: DocumentRef): Promise<DocumentStat> {
    try {
      if (ref.origin === 'workspace') {
        const root = this.requireRoot()
        const handle = await resolveFile(root, this.requireWorkspacePath(ref))
        const file = await handle.getFile()
        return { exists: true, mtime: file.lastModified }
      }
      if (ref.origin === 'file') {
        const handle = await this.getFileHandle(ref.key)
        if (handle) {
          const file = await handle.getFile()
          return { exists: true, mtime: file.lastModified }
        }
        const memory = this.memoryFiles.get(ref.key)
        return { exists: Boolean(memory), mtime: memory?.mtime ?? null }
      }
      return { exists: true, mtime: null }
    } catch {
      return { exists: false, mtime: null }
    }
  }

  async writeAsset(target: AssetTarget, data: Uint8Array): Promise<void> {
    if (target.scope !== 'workspace') throw new Error('UNSUPPORTED')
    const root = this.requireRoot()
    const handle = await resolveFile(root, target.path, true)
    const buffer = new Uint8Array(data.byteLength)
    buffer.set(data)
    await writeFileHandle(handle, buffer)
  }

  async readAsset(target: AssetTarget): Promise<AssetReadResult | null> {
    if (target.scope !== 'workspace') return null
    try {
      const root = this.requireRoot()
      const handle = await resolveFile(root, target.path)
      const file = await handle.getFile()
      return {
        data: new Uint8Array(await file.arrayBuffer()),
        mime: file.type || mimeFromFileName(target.path),
      }
    } catch {
      return null
    }
  }

  async getAssetUrl(target: AssetTarget): Promise<string> {
    if (target.scope !== 'workspace') throw new Error('UNSUPPORTED')
    const key = target.path
    const cached = this.assetUrls.get(key)
    if (cached) return cached
    const root = this.requireRoot()
    const handle = await resolveFile(root, target.path)
    const file = await handle.getFile()
    const url = URL.createObjectURL(file)
    this.assetUrls.set(key, url)
    return url
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []
    const root = this.requireRoot()
    const limit = options?.limit ?? 200
    const results: SearchResult[] = []
    for await (const entry of walkDirectory(root)) {
      if (results.length >= limit) break
      if (entry.kind !== 'file' || !isOpenableTextFile(entry.name)) continue
      const file = await (entry.handle as FsFileHandle).getFile()
      if (file.size > 2 * 1024 * 1024) continue
      const text = await file.text()
      results.push(...searchText(entry.path, entry.name, text, trimmed, options?.caseSensitive))
    }
    return results.slice(0, limit)
  }

  watchWorkspace(): () => void {
    return () => undefined
  }

  watchDocument(): () => void {
    return () => undefined
  }

  async saveHistory(
    input: HistorySnapshotInput,
    options: HistoryOptions,
  ): Promise<HistoryRecord> {
    const db = await getDb()
    const record: HistoryRecord = {
      id: createId('history'),
      documentKey: input.documentKey,
      filePath: input.filePath,
      fileName: input.fileName,
      createdAt: Date.now(),
      source: input.source,
      size: new Blob([input.content]).size,
    }
    await db.put('history', { ...record, content: input.content })

    const entries = await db.getAllFromIndex('history', 'by-document', input.documentKey)
    entries.sort((a, b) => b.createdAt - a.createdAt)
    const cutoff = Date.now() - options.retentionDays * 24 * 60 * 60 * 1000
    const deletions: string[] = []
    entries.forEach((entry, index) => {
      if (index >= options.maxPerFile || entry.createdAt < cutoff) deletions.push(entry.id)
    })
    await Promise.all(deletions.map((id) => db.delete('history', id)))
    return record
  }

  async listHistory(documentKey?: string): Promise<HistoryRecord[]> {
    const db = await getDb()
    const rows = documentKey
      ? await db.getAllFromIndex('history', 'by-document', documentKey)
      : await db.getAll('history')
    return rows
      .map((row): HistoryRecord => ({
        id: row.id,
        documentKey: row.documentKey,
        filePath: row.filePath,
        fileName: row.fileName,
        createdAt: row.createdAt,
        source: row.source,
        size: row.size,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 1000)
  }

  async readHistory(id: string): Promise<HistoryDetail | null> {
    const db = await getDb()
    const row = await db.get('history', id)
    if (!row) return null
    const { content, ...record } = row
    return { record, content }
  }

  async deleteHistory(id: string): Promise<void> {
    const db = await getDb()
    await db.delete('history', id)
  }

  async clearHistory(): Promise<void> {
    const db = await getDb()
    await db.clear('history')
  }

  async loadSettings(): Promise<Partial<AppSettings> | null> {
    return kvGet<Partial<AppSettings>>('settings')
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await kvSet('settings', settings)
  }

  async loadSession(): Promise<SessionState | null> {
    return kvGet<SessionState>('session')
  }

  async saveSession(session: SessionState): Promise<void> {
    await kvSet('session', session)
  }

  async exportHtml(html: string, fileName: string): Promise<boolean> {
    downloadHtml(html, fileName.replace(/\.[^.]+$/, '') + '.html')
    return true
  }

  async exportPdf(html: string): Promise<boolean> {
    await printHtml(html)
    return true
  }

  async openExternal(url: string): Promise<void> {
    if (!/^(https?:|mailto:)/i.test(url)) throw new Error('UNSUPPORTED')
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  getPathForFile(): string | null {
    return null
  }

  onMenuCommand(): () => void {
    return () => undefined
  }

  onOpenFiles(): () => void {
    return () => undefined
  }

  private async storedWorkspaces(): Promise<StoredWorkspace[]> {
    const list = await kvGet<StoredWorkspace[]>(WORKSPACES_KEY)
    if (Array.isArray(list)) return list
    const legacy = await kvGet<StoredWorkspace>(LEGACY_WORKSPACE_KEY)
    return legacy ? [legacy] : []
  }

  private async findStoredWorkspace(
    handle: FsDirectoryHandle,
    list: StoredWorkspace[],
  ): Promise<StoredWorkspace | null> {
    for (const item of list) {
      if (item.handle === handle) return item
      if (!handle.isSameEntry) continue
      try {
        if (await handle.isSameEntry(item.handle)) return item
      } catch {
        // Stale persisted handles can reject comparison; keep scanning.
      }
    }
    return null
  }

  private async persistWorkspace(
    entry: StoredWorkspace,
    stored: StoredWorkspace[],
  ): Promise<void> {
    const next = [
      entry,
      ...stored.filter((item) => item.info.id !== entry.info.id),
    ].slice(0, MAX_STORED_WORKSPACES)
    await kvSet(WORKSPACES_KEY, next)
    await kvSet(LEGACY_WORKSPACE_KEY, entry)
  }

  private requireRoot(): FsDirectoryHandle {
    if (!this.rootHandle) throw new Error('NO_WORKSPACE')
    return this.rootHandle
  }

  private requireWorkspacePath(ref: DocumentRef): string {
    if (!ref.path) throw new Error('INVALID_PATH')
    return normalizeSlashes(ref.path)
  }

  private async resolveEntry(
    parent: FsDirectoryHandle,
    name: string,
  ): Promise<FsFileHandle | FsDirectoryHandle> {
    try {
      return await parent.getFileHandle(name)
    } catch {
      return parent.getDirectoryHandle(name)
    }
  }

  private async findHandleKey(handle: FsFileHandle): Promise<string | null> {
    for (const [key, existing] of this.fileHandles) {
      if (existing === handle) return key
      if (!handle.isSameEntry) continue
      try {
        if (await handle.isSameEntry(existing)) return key
      } catch {
        // Stale persisted handles can reject comparison; keep scanning.
      }
    }
    return null
  }

  private findMemoryFileKey(name: string, content: string): string | null {
    for (const [key, entry] of this.memoryFiles) {
      if (entry.name === name && entry.content === content) return key
    }
    return null
  }

  private async getFileHandle(key: string): Promise<FsFileHandle | null> {
    const cached = this.fileHandles.get(key)
    if (cached) return cached
    const stored = await kvGet<FsFileHandle>(`file:${key}`)
    if (stored) {
      this.fileHandles.set(key, stored)
      return stored
    }
    return null
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
