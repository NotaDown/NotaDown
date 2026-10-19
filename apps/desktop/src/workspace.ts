import { BrowserWindow, dialog, shell } from 'electron'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { promises as fs } from 'node:fs'
import type { Dirent, Stats } from 'node:fs'
import path from 'node:path'
import {
  isOpenableTextFile,
  mimeFromFileName,
  normalizeSlashes,
  searchText,
  DESKTOP_WORKSPACE_EVENTS_CHANNEL,
  type AssetReadResult,
  type FileEntry,
  type OpenWorkspaceResult,
  type OpenedDocument,
  type SearchOptions,
  type SearchResult,
  type WorkspaceEvent,
  type WorkspaceInfo,
} from '@notadown/shared'

const MAX_SEARCH_FILE_SIZE = 2 * 1024 * 1024
const MARKDOWN_FILTERS = [
  {
    name: 'Markdown and text',
    extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'],
  },
]

let rootPath: string | null = null
let watcher: FSWatcher | null = null
let watcherWindow: BrowserWindow | null = null
let pendingEvents: WorkspaceEvent[] = []
let flushTimer: NodeJS.Timeout | null = null

export function currentRoot(): string | null {
  return rootPath
}

export function getWorkspaceInfo(): WorkspaceInfo | null {
  if (!rootPath) return null
  return {
    id: `desktop:${rootPath}`,
    name: path.basename(rootPath) || rootPath,
    rootPath,
  }
}

export async function openWorkspace(
  window: BrowserWindow | null,
): Promise<OpenWorkspaceResult | null> {
  const directory = await showOpenDialog(window, {
    properties: ['openDirectory'],
    title: 'Open folder',
  })
  if (!directory) return null
  return attachRoot(directory)
}

export async function restoreWorkspace(
  directory: string,
): Promise<OpenWorkspaceResult | null> {
  if (!directory || !path.isAbsolute(directory)) return null
  return attachRoot(directory)
}

async function attachRoot(directory: string): Promise<OpenWorkspaceResult | null> {
  const resolved = path.resolve(directory)
  try {
    const stats = await fs.stat(resolved)
    if (!stats.isDirectory()) return null
  } catch {
    return null
  }

  stopWatch()
  rootPath = resolved
  return {
    workspace: {
      id: `desktop:${resolved}`,
      name: path.basename(resolved) || resolved,
      rootPath: resolved,
    },
    entries: await listWorkspace(),
  }
}

export function closeWorkspace(): void {
  stopWatch()
  rootPath = null
}

export async function listWorkspace(): Promise<FileEntry[]> {
  requireRoot()
  const entries: FileEntry[] = []
  await walkDirectory('', entries)
  return entries
}

async function walkDirectory(relativeDir: string, entries: FileEntry[]): Promise<void> {
  const absoluteDir = relativeDir
    ? path.join(requireRoot(), ...relativeDir.split('/'))
    : requireRoot()
  let dirents: Dirent[]
  try {
    dirents = await fs.readdir(absoluteDir, { withFileTypes: true })
  } catch {
    return
  }
  dirents.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  for (const dirent of dirents) {
    if (dirent.name.startsWith('.')) continue
    const relative = relativeDir ? `${relativeDir}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) {
      entries.push({ path: relative, name: dirent.name, kind: 'directory' })
      await walkDirectory(relative, entries)
    } else if (dirent.isFile()) {
      const stats = await statSafe(path.join(absoluteDir, dirent.name))
      entries.push({
        path: relative,
        name: dirent.name,
        kind: 'file',
        size: stats?.size,
        modifiedAt: stats?.mtimeMs,
      })
    }
  }
}

export async function readWorkspaceFile(
  relativePath: string,
): Promise<{ content: string; mtime: number }> {
  return readAbsoluteFile(resolveWorkspacePath(relativePath))
}

export async function writeWorkspaceFile(
  relativePath: string,
  content: string,
): Promise<{ mtime: number }> {
  return writeAbsoluteFile(resolveWorkspacePath(relativePath), content)
}

export async function createWorkspaceFile(relativePath: string, content: string): Promise<void> {
  const target = resolveWorkspacePath(relativePath)
  await fs.writeFile(target, content, { encoding: 'utf8', flag: 'wx' })
}

export async function createWorkspaceDirectory(relativePath: string): Promise<void> {
  const target = resolveWorkspacePath(relativePath)
  await fs.mkdir(target)
}

export async function renameWorkspaceEntry(
  relativePath: string,
  nextRelativePath: string,
): Promise<void> {
  const source = resolveWorkspacePath(relativePath)
  const target = resolveWorkspacePath(nextRelativePath)
  if (source === target) return
  if (await pathExists(target)) throw new Error('ALREADY_EXISTS')
  await fs.rename(source, target)
}

export async function moveWorkspaceEntry(
  relativePath: string,
  destinationDir: string,
): Promise<void> {
  const source = resolveWorkspacePath(relativePath)
  const destination = destinationDir ? resolveWorkspacePath(destinationDir) : requireRoot()
  if (path.dirname(source) === destination) return
  const target = path.join(destination, path.basename(source))
  if (await pathExists(target)) throw new Error('ALREADY_EXISTS')
  await fs.rename(source, target)
}

export async function deleteWorkspaceEntry(relativePath: string): Promise<void> {
  const target = resolveWorkspacePath(relativePath)
  await fs.rm(target, { recursive: true })
}

export async function revealWorkspaceEntry(relativePath: string): Promise<void> {
  const target = resolveWorkspacePath(relativePath)
  shell.showItemInFolder(target)
}

export async function openFileDialog(
  window: BrowserWindow | null,
): Promise<OpenedDocument | null> {
  const selected = await showOpenDialog(window, {
    properties: ['openFile'],
    filters: MARKDOWN_FILTERS,
  })
  if (!selected) return null
  const opened = await readAbsoluteFile(selected)
  return {
    ref: {
      key: `file:${selected}`,
      name: path.basename(selected),
      path: selected,
      origin: 'file',
    },
    content: opened.content,
    mtime: opened.mtime,
  }
}

export async function readAbsoluteFile(
  absolutePath: string,
): Promise<{ content: string; mtime: number }> {
  const target = requireAbsolutePath(absolutePath)
  const [content, stats] = await Promise.all([
    fs.readFile(target, 'utf8'),
    fs.stat(target),
  ])
  if (!stats.isFile()) throw new Error('INVALID_PATH')
  return { content, mtime: stats.mtimeMs }
}

export async function writeAbsoluteFile(
  absolutePath: string,
  content: string,
): Promise<{ mtime: number }> {
  const target = requireAbsolutePath(absolutePath)
  await fs.writeFile(target, content, 'utf8')
  const stats = await fs.stat(target)
  return { mtime: stats.mtimeMs }
}

export async function saveFileDialog(
  window: BrowserWindow | null,
  suggestedName: string,
  content: string,
  defaultDirectory: string | null,
): Promise<OpenedDocument['ref'] | null> {
  const defaultPath =
    defaultDirectory && path.isAbsolute(defaultDirectory)
      ? path.join(defaultDirectory, suggestedName)
      : suggestedName
  const target = await showSaveDialog(window, {
    defaultPath,
    filters: MARKDOWN_FILTERS,
  })
  if (!target) return null
  await fs.writeFile(target, content, 'utf8')
  return {
    key: `file:${target}`,
    name: path.basename(target),
    path: target,
    origin: 'file',
  }
}

export async function statFile(
  absolutePath: string,
): Promise<{ exists: boolean; mtime: number | null }> {
  try {
    const stats = await fs.stat(requireAbsolutePath(absolutePath))
    return { exists: true, mtime: stats.mtimeMs }
  } catch {
    return { exists: false, mtime: null }
  }
}

export async function writeImageFile(
  absolutePath: string,
  data: Uint8Array,
  _mime: string,
): Promise<void> {
  const target = requireAbsolutePath(absolutePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, Buffer.from(data))
}

export async function readAsset(absolutePath: string): Promise<AssetReadResult | null> {
  try {
    const target = requireAbsolutePath(absolutePath)
    const data = await fs.readFile(target)
    return { data, mime: mimeFromFileName(target) }
  } catch {
    return null
  }
}

export async function searchWorkspace(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const limit = options?.limit ?? 200
  const results: SearchResult[] = []
  const entries = await listWorkspace()

  for (const entry of entries) {
    if (results.length >= limit) break
    if (entry.kind !== 'file' || !isOpenableTextFile(entry.name)) continue
    if ((entry.size ?? 0) > MAX_SEARCH_FILE_SIZE) continue
    let content: string
    try {
      content = await fs.readFile(resolveWorkspacePath(entry.path), 'utf8')
    } catch {
      continue
    }
    results.push(
      ...searchText(entry.path, entry.name, content, trimmed, options?.caseSensitive),
    )
  }

  return results.slice(0, limit)
}

export function startWatch(window: BrowserWindow): void {
  const root = requireRoot()
  stopWatch()
  watcherWindow = window

  const active = watch(root, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    ignored: (candidate) => isIgnoredPath(root, candidate),
  })
  watcher = active

  active.on('all', (eventName, changedPath) => {
    if (eventName === 'ready' || eventName === 'raw' || eventName === 'error') return
    const relative = relativeFromRoot(root, changedPath)
    if (!relative) return
    const type = eventName as WorkspaceEvent['type']
    const event: WorkspaceEvent = {
      type,
      path: relative,
      isDirectory: type === 'addDir' || type === 'unlinkDir',
    }
    void queueEvent(event, changedPath)
  })
  active.on('error', () => undefined)
}

export function stopWatch(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  pendingEvents = []
  watcherWindow = null
  const active = watcher
  watcher = null
  if (active) void active.close()
}

async function queueEvent(event: WorkspaceEvent, absolutePath: string): Promise<void> {
  if (event.type === 'change') {
    const stats = await statSafe(absolutePath)
    if (stats) event.mtime = stats.mtimeMs
  }
  pendingEvents.push(event)
  if (flushTimer) return
  flushTimer = setTimeout(flushEvents, 120)
}

function flushEvents(): void {
  flushTimer = null
  const window = watcherWindow
  const events = pendingEvents
  pendingEvents = []
  if (!events.length || !window || window.isDestroyed()) return
  window.webContents.send(DESKTOP_WORKSPACE_EVENTS_CHANNEL, events)
}

function isIgnoredPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  if (!relative) return false
  if (relative.startsWith('..') || path.isAbsolute(relative)) return true
  return normalizeSlashes(relative)
    .split('/')
    .some((segment) => segment.startsWith('.'))
}

function relativeFromRoot(root: string, candidate: string): string | null {
  const relative = path.relative(root, candidate)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return normalizeSlashes(relative)
}

function requireRoot(): string {
  if (!rootPath) throw new Error('NO_WORKSPACE')
  return rootPath
}

function resolveWorkspacePath(relativePath: string): string {
  const root = requireRoot()
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error('INVALID_PATH')
  }
  const resolved = path.resolve(root, relativePath)
  const rootResolved = path.resolve(root)
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error('INVALID_PATH')
  }
  return resolved
}

function requireAbsolutePath(absolutePath: string): string {
  if (!absolutePath || !path.isAbsolute(absolutePath)) throw new Error('INVALID_PATH')
  return absolutePath
}

async function statSafe(target: string): Promise<Stats | null> {
  try {
    return await fs.stat(target)
  } catch {
    return null
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function showOpenDialog(
  window: BrowserWindow | null,
  options: OpenDialogOptions,
): Promise<string | null> {
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths.length) return null
  return result.filePaths[0]
}

async function showSaveDialog(
  window: BrowserWindow | null,
  options: SaveDialogOptions,
): Promise<string | null> {
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}
