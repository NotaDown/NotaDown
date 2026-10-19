import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  basename,
  dirname,
  extensionOf,
  joinPosix,
  normalizeSlashes,
  sanitizeFileName,
  type FileEntry,
  type SearchResult,
  type WorkspaceEvent,
  type WorkspaceInfo,
} from '@notadown/shared'
import { platform } from '@/platform'
import { useSettingsStore } from './settings'

export interface WorkspaceNode extends FileEntry {
  children: WorkspaceNode[]
}

type ExternalHandler = (events: WorkspaceEvent[]) => void

export const useWorkspaceStore = defineStore('workspace', () => {
  const settings = useSettingsStore()

  const info = ref<WorkspaceInfo | null>(null)
  const entries = ref<FileEntry[]>([])
  const loading = ref(false)
  const searching = ref(false)
  const searchResults = ref<SearchResult[]>([])
  const searchQuery = ref('')
  const expandedDirs = ref(new Set<string>(['']))
  const selectedPath = ref<string | null>(null)

  let watchStop: (() => void) | null = null
  let refreshTimer: number | null = null
  let searchToken = 0
  let searchTimer: number | null = null
  const externalHandlers = new Set<ExternalHandler>()

  const isOpen = computed(() => info.value !== null)
  const fileEntries = computed(() => entries.value.filter((entry) => entry.kind === 'file'))
  const tree = computed(() => buildTree(entries.value))
  const entryPaths = computed(() => new Set(entries.value.map((entry) => entry.path)))

  async function open(): Promise<boolean> {
    loading.value = true
    try {
      const result = await platform.openWorkspace()
      if (!result) return false
      applyWorkspace(result.workspace, result.entries)
      return true
    } finally {
      loading.value = false
    }
  }

  async function restore(workspaceInfo: WorkspaceInfo): Promise<boolean> {
    loading.value = true
    try {
      const result = await platform.restoreWorkspace(workspaceInfo)
      if (!result) return false
      applyWorkspace(result.workspace, result.entries)
      return true
    } catch {
      return false
    } finally {
      loading.value = false
    }
  }

  function applyWorkspace(workspaceInfo: WorkspaceInfo, nextEntries: FileEntry[]): void {
    stopWatch()
    info.value = workspaceInfo
    entries.value = nextEntries
    expandedDirs.value = new Set([''])
    selectedPath.value = null
    searchResults.value = []
    searchQuery.value = ''
    startWatch()
  }

  async function close(): Promise<void> {
    stopWatch()
    info.value = null
    entries.value = []
    searchResults.value = []
    searchQuery.value = ''
    selectedPath.value = null
    expandedDirs.value = new Set([''])
    try {
      await platform.closeWorkspace()
    } catch {
      // Closing a workspace is best-effort; local state is already cleared.
    }
  }

  async function refresh(): Promise<void> {
    if (!info.value) return
    try {
      entries.value = await platform.listWorkspace()
      if (selectedPath.value && !entryPaths.value.has(selectedPath.value)) {
        selectedPath.value = null
      }
    } catch {
      // The directory can disappear or lose permission while open.
    }
  }

  function scheduleRefresh(): void {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      void refresh()
    }, 250)
  }

  function startWatch(): void {
    if (!platform.capabilities.fileSystemWatching || !info.value) return
    watchStop = platform.watchWorkspace((events) => {
      let structural = false
      for (const event of events) {
        if (event.type === 'add' || event.type === 'addDir' || event.type === 'unlink' || event.type === 'unlinkDir') {
          structural = true
        } else if (event.type === 'change' && typeof event.mtime === 'number') {
          const entry = entries.value.find((item) => item.path === event.path)
          if (entry) entry.modifiedAt = event.mtime
        }
      }
      if (structural) scheduleRefresh()
      for (const handler of externalHandlers) handler(events)
    })
  }

  function stopWatch(): void {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }
    watchStop?.()
    watchStop = null
  }

  function subscribeEvents(handler: ExternalHandler): () => void {
    externalHandlers.add(handler)
    return () => externalHandlers.delete(handler)
  }

  function toggleDir(path: string): void {
    const next = new Set(expandedDirs.value)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    expandedDirs.value = next
  }

  function expandPath(path: string): void {
    const segments = normalizeSlashes(path).split('/')
    segments.pop()
    let current = ''
    const next = new Set(expandedDirs.value)
    next.add('')
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      next.add(current)
    }
    expandedDirs.value = next
  }

  function select(path: string | null): void {
    selectedPath.value = path
  }

  function hasEntry(path: string): boolean {
    return entryPaths.value.has(normalizeSlashes(path))
  }

  async function createFile(parentDir: string, rawName: string): Promise<string | null> {
    const name = normalizeFileName(rawName, settings.settings.defaultFileExtension)
    if (!name) return null
    const path = joinPosix(parentDir, name)
    if (hasEntry(path)) throw new Error('ALREADY_EXISTS')
    await platform.createWorkspaceFile(path, '')
    await refresh()
    expandPath(path)
    selectedPath.value = path
    return path
  }

  async function createDirectory(parentDir: string, rawName: string): Promise<string | null> {
    const name = sanitizeFileName(rawName)
    if (!name) return null
    const path = joinPosix(parentDir, name)
    if (hasEntry(path)) throw new Error('ALREADY_EXISTS')
    await platform.createWorkspaceDirectory(path)
    await refresh()
    const next = new Set(expandedDirs.value)
    next.add(parentDir)
    next.add(path)
    expandedDirs.value = next
    selectedPath.value = path
    return path
  }

  async function renameEntry(path: string, rawName: string): Promise<string | null> {
    const clean = normalizeSlashes(path)
    const isFile = entries.value.find((entry) => entry.path === clean)?.kind === 'file'
    let name = sanitizeFileName(rawName)
    if (!name) return null
    if (isFile) {
      const extension = extensionOf(clean)
      if (extension && !extensionOf(name)) name = `${name}.${extension}`
    }
    const nextPath = joinPosix(dirname(clean), name)
    if (nextPath === clean) return clean
    if (hasEntry(nextPath)) throw new Error('ALREADY_EXISTS')
    await platform.renameWorkspaceEntry(clean, nextPath)
    await refresh()
    selectedPath.value = nextPath
    return nextPath
  }

  async function moveEntry(path: string, destinationDir: string): Promise<string | null> {
    const source = normalizeSlashes(path)
    const destination = normalizeSlashes(destinationDir)
    if (dirname(source) === destination) return source
    if (destination === source || destination.startsWith(`${source}/`)) {
      throw new Error('INVALID_PATH')
    }
    const nextPath = joinPosix(destination, basename(source))
    if (hasEntry(nextPath)) throw new Error('ALREADY_EXISTS')
    await platform.moveWorkspaceEntry(source, destination)
    await refresh()
    expandPath(nextPath)
    selectedPath.value = nextPath
    return nextPath
  }

  async function deleteEntry(path: string): Promise<void> {
    const isDirectory = entries.value.find((entry) => entry.path === path)?.kind === 'directory'
    await platform.deleteWorkspaceEntry(path, isDirectory ?? false)
    if (selectedPath.value?.startsWith(normalizeSlashes(path))) selectedPath.value = null
    await refresh()
  }

  async function revealEntry(path: string): Promise<void> {
    await platform.revealWorkspaceEntry(path)
  }

  function setSearchQuery(query: string): void {
    searchQuery.value = query
  }

  async function search(query: string, caseSensitive = false): Promise<void> {
    searchQuery.value = query
    if (searchTimer) {
      window.clearTimeout(searchTimer)
      searchTimer = null
    }
    const trimmed = query.trim()
    if (!trimmed || !info.value) {
      searching.value = false
      searchResults.value = []
      return
    }

    searching.value = true
    const token = ++searchToken
    try {
      const results = await new Promise<SearchResult[]>((resolve) => {
        searchTimer = window.setTimeout(() => {
          searchTimer = null
          void platform.search(trimmed, { caseSensitive }).then(resolve, () => resolve([]))
        }, 220)
      })
      if (token !== searchToken) return
      searchResults.value = results
    } finally {
      if (token === searchToken) searching.value = false
    }
  }

  function clearSearch(): void {
    searchToken += 1
    if (searchTimer) {
      window.clearTimeout(searchTimer)
      searchTimer = null
    }
    searchQuery.value = ''
    searchResults.value = []
    searching.value = false
  }

  return {
    info,
    entries,
    loading,
    searching,
    searchResults,
    searchQuery,
    expandedDirs,
    selectedPath,
    isOpen,
    fileEntries,
    tree,
    entryPaths,
    open,
    restore,
    close,
    refresh,
    subscribeEvents,
    toggleDir,
    expandPath,
    select,
    hasEntry,
    createFile,
    createDirectory,
    renameEntry,
    moveEntry,
    deleteEntry,
    revealEntry,
    setSearchQuery,
    search,
    clearSearch,
  }
})

function normalizeFileName(rawName: string, extension: string): string {
  const clean = sanitizeFileName(rawName)
  if (!clean) return ''
  if (/\.[a-zA-Z0-9]{1,8}$/.test(clean)) return clean
  return `${clean}.${extension}`
}

function buildTree(entries: FileEntry[]): WorkspaceNode[] {
  const nodes = new Map<string, WorkspaceNode>()
  const roots: WorkspaceNode[] = []

  for (const entry of entries) {
    const path = normalizeSlashes(entry.path)
    nodes.set(path, { ...entry, path, children: [] })
  }

  const ensureDirectory = (path: string, name: string): WorkspaceNode => {
    const existing = nodes.get(path)
    if (existing) return existing
    const node: WorkspaceNode = { path, name, kind: 'directory', children: [] }
    nodes.set(path, node)
    return node
  }

  for (const node of nodes.values()) {
    const parentPath = dirname(node.path)
    if (!parentPath) {
      roots.push(node)
      continue
    }
    const parentName = basename(parentPath)
    const parent = ensureDirectory(parentPath, parentName)
    parent.children.push(node)
  }

  const sortNodes = (list: WorkspaceNode[]): void => {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}
