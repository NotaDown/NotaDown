import { isHiddenPath, normalizeSlashes } from '@notadown/shared'

export interface FsWritable {
  write(data: BufferSource | Blob | string): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

export interface FsHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  isSameEntry?(other: FsHandle): Promise<boolean>
  move?(parent: FsDirectoryHandle, name?: string): Promise<void>
}

export interface FsFileHandle extends FsHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(options?: { keepExistingData?: boolean }): Promise<FsWritable>
  move?(parent: FsDirectoryHandle, name?: string): Promise<void>
}

export interface FsDirectoryHandle extends FsHandle {
  readonly kind: 'directory'
  entries(): AsyncIterableIterator<[string, FsHandle]>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  move?(parent: FsDirectoryHandle, name?: string): Promise<void>
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: string
  }) => Promise<FsDirectoryHandle>
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<FsFileHandle[]>
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<FsFileHandle>
}

export function fsaWindow(): PickerWindow {
  return window as PickerWindow
}

export function supportsDirectoryPicker(): boolean {
  return typeof fsaWindow().showDirectoryPicker === 'function'
}

export function supportsFilePicker(): boolean {
  return typeof fsaWindow().showOpenFilePicker === 'function'
}

export async function ensurePermission(
  handle: FsHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true
  const descriptor = { mode }
  const state = await handle.queryPermission(descriptor)
  if (state === 'granted') return true
  return (await handle.requestPermission(descriptor)) === 'granted'
}

export function pathSegments(path: string): string[] {
  return normalizeSlashes(path)
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
}

export async function resolveDirectory(
  root: FsDirectoryHandle,
  segments: string[],
  create = false,
): Promise<FsDirectoryHandle> {
  let current = root
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create })
  }
  return current
}

export async function resolveFile(
  root: FsDirectoryHandle,
  path: string,
  create = false,
): Promise<FsFileHandle> {
  const segments = pathSegments(path)
  const fileName = segments.pop()
  if (!fileName) throw new Error('Invalid file path')
  const parent = await resolveDirectory(root, segments, create)
  return parent.getFileHandle(fileName, { create })
}

export async function getParentDirectory(
  root: FsDirectoryHandle,
  path: string,
  create = false,
): Promise<{ parent: FsDirectoryHandle; name: string }> {
  const segments = pathSegments(path)
  const name = segments.pop()
  if (!name) throw new Error('Invalid entry path')
  const parent = await resolveDirectory(root, segments, create)
  return { parent, name }
}

export async function entryExists(
  root: FsDirectoryHandle,
  path: string,
): Promise<'file' | 'directory' | null> {
  try {
    const { parent, name } = await getParentDirectory(root, path)
    try {
      await parent.getFileHandle(name)
      return 'file'
    } catch {
      await parent.getDirectoryHandle(name)
      return 'directory'
    }
  } catch {
    return null
  }
}

export interface WalkedEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  handle: FsHandle
}

export async function* walkDirectory(
  directory: FsDirectoryHandle,
  prefix = '',
): AsyncGenerator<WalkedEntry> {
  const entries: Array<[string, FsHandle]> = []
  for await (const entry of directory.entries()) {
    entries.push(entry)
  }
  entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))

  for (const [name, handle] of entries) {
    if (name.startsWith('.')) continue
    const path = prefix ? `${prefix}/${name}` : name
    if (isHiddenPath(path)) continue
    if (handle.kind === 'directory') {
      yield { path, name, kind: 'directory', handle: handle as FsDirectoryHandle }
      yield* walkDirectory(handle as FsDirectoryHandle, path)
    } else {
      yield { path, name, kind: 'file', handle: handle as FsFileHandle }
    }
  }
}

export async function writeFileHandle(
  handle: FsFileHandle,
  data: BufferSource | Blob | string,
): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(data as BufferSource)
    await writable.close()
  } catch (error) {
    await writable.abort?.()
    throw error
  }
}

async function copyDirectory(
  source: FsDirectoryHandle,
  destination: FsDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of source.entries()) {
    if (handle.kind === 'directory') {
      const child = await destination.getDirectoryHandle(name, { create: true })
      await copyDirectory(handle as FsDirectoryHandle, child)
    } else {
      const sourceFile = await (handle as FsFileHandle).getFile()
      const target = await destination.getFileHandle(name, { create: true })
      await writeFileHandle(target, await sourceFile.arrayBuffer())
    }
  }
}

export async function moveHandle(
  source: FsHandle,
  sourceParent: FsDirectoryHandle,
  sourceName: string,
  destinationParent: FsDirectoryHandle,
  nextName: string,
): Promise<void> {
  if (source.move) {
    await source.move(destinationParent, nextName)
    return
  }
  if (source.kind === 'file') {
    const file = await (source as FsFileHandle).getFile()
    const target = await destinationParent.getFileHandle(nextName, { create: true })
    await writeFileHandle(target, await file.arrayBuffer())
    await sourceParent.removeEntry(sourceName, { recursive: false })
    return
  }
  const targetDir = await destinationParent.getDirectoryHandle(nextName, { create: true })
  await copyDirectory(source as FsDirectoryHandle, targetDir)
  await sourceParent.removeEntry(sourceName, { recursive: true })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}

export function downloadHtml(html: string, fileName: string): void {
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName)
}

export async function printHtml(html: string): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve()
    iframe.onerror = () => reject(new Error('Failed to load print document'))
    iframe.srcdoc = html
    setTimeout(resolve, 4000)
  })

  await new Promise((resolve) => setTimeout(resolve, 600))
  const frameWindow = iframe.contentWindow
  if (!frameWindow) {
    iframe.remove()
    throw new Error('Print frame unavailable')
  }
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup)
      setTimeout(() => iframe.remove(), 500)
      resolve()
    }
    iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true })
    frameWindow.focus()
    frameWindow.print()
    setTimeout(cleanup, 3000)
  })
}
