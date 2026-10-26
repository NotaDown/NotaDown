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
import { useRecentStore } from './recent'
import { useSettingsStore } from './settings'

export interface WorkspaceNode extends FileEntry {
  children: WorkspaceNode[]
}

type ExternalHandler = (events: WorkspaceEvent[]) => void

export const useWorkspaceStore = defineStore('workspace', () => {
  const settings = useSettingsStore()

  const info = ref<WorkspaceInfo | null>(null)
  const directories = ref<Record<string, FileEntry[]>>({})
  const loading = ref(false)
  const searching = ref(false)
  const searchResults = ref<SearchResult[]>([])
  const searchQuery = ref('')
  const expandedDirs = ref(new Set<string>(['']))
  const selectedPath = ref<string | null>(null)

  let watchStop: (() => void) | null = null
  let refreshTimer: number | null = null
  let watchSyncTimer: number | null = null
  let searchToken = 0
  let searchTimer: number | null = null
  const externalHandlers = new Set<ExternalHandler>()
  const directoryLoads = new Map<string, Promise<void>>()
  const pendingRefreshDirs = new Set<string>()

  const isOpen = computed(() => info.value !== null)
  const entries = computed(() => Object.values(directories.value).flat())
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
    directories.value = { '': nextEntries }
    expandedDirs.value = new Set([''])
    selectedPath.value = null
    searchResults.value = []
    searchQuery.value = ''
    startWatch()
    useRecentStore().recordFolder(workspaceInfo)
  }

  async function close(): Promise<void> {
    stopWatch()
    info.value = null
    directories.value = {}
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

  function directoryLoaded(path: string): boolean {
    return Object.hasOwn(directories.value, normalizeDirectoryPath(path))
  }

  async function loadDirectory(path: string, force = false): Promise<void> {
    if (!info.value) return
    const dir = normalizeDirectoryPath(path)
    if (!force && directoryLoaded(dir)) return
    const pending = directoryLoads.get(dir)
    if (pending) return pending
    const task = (async () => {
      try {
        const list = await platform.listWorkspaceDirectory(dir)
        directories.value = { ...directories.value, [dir]: list }
      } catch {
        if (dir) dropDirectory(dir)
      } finally {
        directoryLoads.delete(dir)
        scheduleWatchSync()
      }
    })()
    directoryLoads.set(dir, task)
    return task
  }

  async function refresh(): Promise<void> {
    if (!info.value) return
    const dirs = Object.keys(directories.value)
    await Promise.all(dirs.map((dir) => loadDirectory(dir, true)))
    if (selectedPath.value && !entryPaths.value.has(selectedPath.value)) {
      selectedPath.value = null
    }
  }

  function scheduleRefreshOf(dirs: Iterable<string>): void {
    for (const dir of dirs) pendingRefreshDirs.add(dir)
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      const targets = [...pendingRefreshDirs]
      pendingRefreshDirs.clear()
      for (const dir of targets) {
        if (directoryLoaded(dir)) void loadDirectory(dir, true)
      }
    }, 150)
  }

  function dropDirectory(path: string): void {
    const clean = normalizeDirectoryPath(path)
    if (!clean) return
    const next = { ...directories.value }
    let changed = false
    for (const key of Object.keys(next)) {
      if (key === clean || key.startsWith(`${clean}/`)) {
        delete next[key]
        changed = true
      }
    }
    if (!changed) return
    directories.value = next
    const expanded = new Set(expandedDirs.value)
    for (const key of expanded) {
      if (key === clean || key.startsWith(`${clean}/`)) expanded.delete(key)
    }
    expandedDirs.value = expanded
    if (selectedPath.value === clean || selectedPath.value?.startsWith(`${clean}/`)) {
      selectedPath.value = null
    }
    scheduleWatchSync()
  }

  function startWatch(): void {
    if (!platform.capabilities.fileSystemWatching || !info.value) return
    watchStop = platform.watchWorkspace((events) => {
      const touched = new Set<string>()
      for (const event of events) {
        if (event.type === 'unlinkDir') dropDirectory(event.path)
        touched.add(dirname(normalizeSlashes(event.path)))
      }
      if (touched.size) scheduleRefreshOf(touched)
      for (const handler of externalHandlers) handler(events)
    })
    scheduleWatchSync()
  }

  function stopWatch(): void {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }
    if (watchSyncTimer) {
      window.clearTimeout(watchSyncTimer)
      watchSyncTimer = null
    }
    pendingRefreshDirs.clear()
    directoryLoads.clear()
    watchStop?.()
    watchStop = null
  }

  function scheduleWatchSync(): void {
    if (!info.value || !platform.capabilities.fileSystemWatching) return
    if (watchSyncTimer) window.clearTimeout(watchSyncTimer)
    watchSyncTimer = window.setTimeout(() => {
      watchSyncTimer = null
      if (!info.value) return
      platform.setWorkspaceWatchDirectories(visibleExpandedDirs())
    }, 50)
  }

  function visibleExpandedDirs(): string[] {
    const expanded = expandedDirs.value
    const dirs = new Set<string>([''])
    for (const dir of expanded) {
      if (!dir) continue
      let visible = true
      let parent = dirname(dir)
      while (parent) {
        if (!expanded.has(parent)) {
          visible = false
          break
        }
        parent = dirname(parent)
      }
      if (visible) dirs.add(dir)
    }
    return [...dirs]
  }

  function subscribeEvents(handler: ExternalHandler): () => void {
    externalHandlers.add(handler)
    return () => externalHandlers.delete(handler)
  }

  async function toggleDir(path: string): Promise<void> {
    const clean = normalizeDirectoryPath(path)
    const next = new Set(expandedDirs.value)
    if (next.has(clean)) {
      next.delete(clean)
      expandedDirs.value = next
      scheduleWatchSync()
      return
    }
    next.add(clean)
    expandedDirs.value = next
    scheduleWatchSync()
    await loadExpandedSubtree(clean)
  }

  async function expandPath(path: string): Promise<void> {
    const segments = normalizeSlashes(path).split('/')
    segments.pop()
    const wasExpanded = new Set(expandedDirs.value)
    const next = new Set(wasExpanded)
    next.add('')
    const ancestors: string[] = []
    let current = ''
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment
      next.add(current)
      ancestors.push(current)
    }
    expandedDirs.value = next

    const topmostNew = ancestors.find((dir) => !wasExpanded.has(dir))
    if (topmostNew) {
      // Folders that were hidden are not watched, so their cache may be stale.
      scheduleWatchSync()
      await loadExpandedSubtree(topmostNew)
      return
    }
    for (const dir of ancestors) await loadDirectory(dir)
  }

  async function loadExpandedSubtree(dir: string): Promise<void> {
    const prefix = dir ? `${dir}/` : ''
    const targets = [dir]
    for (const child of expandedDirs.value) {
      if (!child || child === dir) continue
      if (dir && !child.startsWith(prefix)) continue
      targets.push(child)
    }
    await Promise.all(targets.map((target) => loadDirectory(target, true)))
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
    await loadDirectory(parentDir, true)
    await expandPath(path)
    selectedPath.value = path
    return path
  }

  async function createDirectory(parentDir: string, rawName: string): Promise<string | null> {
    const name = sanitizeFileName(rawName)
    if (!name) return null
    const path = joinPosix(parentDir, name)
    if (hasEntry(path)) throw new Error('ALREADY_EXISTS')
    await platform.createWorkspaceDirectory(path)
    await loadDirectory(parentDir, true)
    const next = new Set(expandedDirs.value)
    next.add(parentDir)
    next.add(path)
    expandedDirs.value = next
    await loadDirectory(path)
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
    if (!isFile) dropDirectory(clean)
    await Promise.all([
      loadDirectory(dirname(clean), true),
      loadDirectory(dirname(nextPath), true),
    ])
    selectedPath.value = nextPath
    return nextPath
  }

  async function duplicateEntry(path: string, suffix: string): Promise<string | null> {
    const clean = normalizeSlashes(path)
    const entry = entries.value.find((item) => item.path === clean)
    if (!entry) return null
    const parent = dirname(clean)
    const extension = entry.kind === 'file' ? extensionOf(entry.name) : ''
    const stem = extension ? entry.name.slice(0, entry.name.length - extension.length - 1) : entry.name
    const base = `${stem}-${suffix}`
    const nameFor = (index: number): string => {
      const name = index === 1 ? base : `${base}${index}`
      return extension ? `${name}.${extension}` : name
    }
    let index = 1
    while (hasEntry(joinPosix(parent, nameFor(index)))) index += 1
    const nextPath = joinPosix(parent, nameFor(index))
    await platform.copyWorkspaceEntry(clean, nextPath)
    await loadDirectory(parent, true)
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
    const isDirectory = entries.value.find((entry) => entry.path === source)?.kind === 'directory'
    await platform.moveWorkspaceEntry(source, destination)
    if (isDirectory) dropDirectory(source)
    await Promise.all([
      loadDirectory(dirname(source), true),
      loadDirectory(destination, true),
    ])
    await expandPath(nextPath)
    selectedPath.value = nextPath
    return nextPath
  }

  async function deleteEntry(path: string): Promise<void> {
    const clean = normalizeSlashes(path)
    const isDirectory = entries.value.find((entry) => entry.path === clean)?.kind === 'directory'
    await platform.deleteWorkspaceEntry(clean, isDirectory ?? false)
    if (isDirectory) dropDirectory(clean)
    if (selectedPath.value === clean || selectedPath.value?.startsWith(`${clean}/`)) {
      selectedPath.value = null
    }
    await loadDirectory(dirname(clean), true)
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
    tree,
    entryPaths,
    open,
    restore,
    applyWorkspace,
    close,
    refresh,
    directoryLoaded,
    subscribeEvents,
    toggleDir,
    expandPath,
    select,
    hasEntry,
    createFile,
    createDirectory,
    renameEntry,
    duplicateEntry,
    moveEntry,
    deleteEntry,
    revealEntry,
    setSearchQuery,
    search,
    clearSearch,
  }
})

function normalizeDirectoryPath(path: string): string {
  return normalizeSlashes(path).replace(/^\/+|\/+$/g, '')
}

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
