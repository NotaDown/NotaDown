import { describe, expect, it, vi } from 'vitest'
import {
  basename,
  type DesktopBridge,
  type DocumentChangeEvent,
  type WorkspaceInfo,
} from '@notadown/shared'
import { DesktopPlatform } from '../src/desktop/desktop-platform'

interface BridgeOptions {
  workspace?: WorkspaceInfo
  filePath?: string | null
  files?: Record<string, string>
  openFiles?: string[]
  platform?: string
  attachAnyRoot?: boolean
}

function createBridge(options: BridgeOptions = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const openFileListeners = new Set<() => void>()
  const documentListeners = new Set<(events: DocumentChangeEvent[]) => void>()

  const bridge = {
    invoke: async (method: string, ...args: unknown[]) => {
      calls.push({ method, args })
      switch (method) {
        case 'openWorkspace':
        case 'restoreWorkspace':
          if (options.attachAnyRoot) {
            const rootPath = String(args[0] ?? '')
            return {
              workspace: { id: `desktop:${rootPath}`, name: basename(rootPath), rootPath },
              entries: [],
            }
          }
          if (!options.workspace) return null
          return { workspace: options.workspace, entries: [] }
        case 'readWorkspaceFile':
          return { content: options.files?.[String(args[0])] ?? '', mtime: 1 }
        case 'readFile':
          return { content: options.files?.[String(args[0])] ?? '', mtime: 2 }
        case 'takeOpenFiles':
          return options.openFiles ?? []
        default:
          return undefined
      }
    },
    assetUrl: (absolutePath: string) => absolutePath,
    getPathForFile: () => options.filePath ?? null,
    onWorkspaceEvents: () => () => undefined,
    onDocumentEvents: (callback: (events: DocumentChangeEvent[]) => void) => {
      documentListeners.add(callback)
      return () => documentListeners.delete(callback)
    },
    onMenuCommand: () => () => undefined,
    onOpenFiles: (callback: () => void) => {
      openFileListeners.add(callback)
      return () => openFileListeners.delete(callback)
    },
    platform: options.platform ?? 'win32',
  } as unknown as DesktopBridge

  return { bridge, calls, openFileListeners, documentListeners }
}

async function createPlatform(options: BridgeOptions = {}) {
  const fake = createBridge(options)
  const platform = new DesktopPlatform(fake.bridge, '1.0.0')
  if (options.workspace) await platform.restoreWorkspace(options.workspace)
  return { platform, ...fake }
}

describe('DesktopPlatform.documentRefForPath', () => {
  it('maps paths inside a Windows workspace case-insensitively', async () => {
    const { platform } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
    })

    expect(platform.documentRefForPath('c:\\docs\\VAULT\\notes\\Note.md')).toEqual({
      key: 'workspace:C:/Docs/Vault/notes/Note.md',
      name: 'Note.md',
      path: 'notes/Note.md',
      origin: 'workspace',
    })
  })

  it('ignores a trailing slash on the workspace root', async () => {
    const { platform } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault\\' },
    })

    expect(platform.documentRefForPath('C:\\Docs\\Vault\\a.md')).toMatchObject({
      origin: 'workspace',
      path: 'a.md',
    })
  })

  it('keeps paths outside the workspace as file refs', async () => {
    const { platform } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
    })

    expect(platform.documentRefForPath('C:\\Docs\\Vault2\\Note.md')).toEqual({
      key: 'file:C:\\Docs\\Vault2\\Note.md',
      name: 'Note.md',
      path: 'C:\\Docs\\Vault2\\Note.md',
      origin: 'file',
    })
  })

  it('matches POSIX workspace roots case-sensitively', async () => {
    const { platform } = await createPlatform({
      workspace: { id: 'ws-2', name: 'vault', rootPath: '/home/me/vault' },
    })

    expect(platform.documentRefForPath('/home/me/vault/notes/a.md')).toMatchObject({
      origin: 'workspace',
      path: 'notes/a.md',
    })
    expect(platform.documentRefForPath('/home/me/Vault/notes/a.md')).toMatchObject({
      origin: 'file',
    })
  })

  it('returns a file ref when no workspace is open', async () => {
    const { platform } = await createPlatform()

    expect(platform.documentRefForPath('C:\\Notes\\a.md')).toEqual({
      key: 'file:C:\\Notes\\a.md',
      name: 'a.md',
      path: 'C:\\Notes\\a.md',
      origin: 'file',
    })
  })
})

describe('DesktopPlatform.openDroppedFile', () => {
  it('opens a dropped file inside the workspace through the workspace API', async () => {
    const { platform, calls } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
      filePath: 'C:\\Docs\\Vault\\note.md',
      files: { 'note.md': '# Note' },
    })

    const opened = await platform.openDroppedFile(new File(['ignored'], 'note.md'))

    expect(opened).toMatchObject({
      ref: { origin: 'workspace', path: 'note.md', name: 'note.md' },
      content: '# Note',
      mtime: 1,
    })
    expect(calls).toContainEqual({ method: 'readWorkspaceFile', args: ['note.md'] })
  })

  it('opens a dropped file outside the workspace through the file API', async () => {
    const { platform, calls } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
      filePath: 'D:\\Notes\\note.md',
      files: { 'D:\\Notes\\note.md': 'body' },
    })

    const opened = await platform.openDroppedFile(new File(['ignored'], 'note.md'))

    expect(opened).toMatchObject({
      ref: { origin: 'file', path: 'D:\\Notes\\note.md' },
      content: 'body',
      mtime: 2,
    })
    expect(calls).toContainEqual({ method: 'readFile', args: ['D:\\Notes\\note.md'] })
  })

  it('rejects unsupported file types before touching the bridge', async () => {
    const { platform, calls } = await createPlatform({ filePath: 'C:\\Notes\\image.png' })

    expect(await platform.openDroppedFile(new File(['x'], 'image.png'))).toBeNull()
    expect(calls.map((call) => call.method)).not.toContain('readFile')
  })

  it('returns null when the shell cannot resolve an absolute path', async () => {
    const { platform, calls } = await createPlatform({ filePath: null })

    expect(await platform.openDroppedFile(new File(['x'], 'note.md'))).toBeNull()
    expect(calls.map((call) => call.method)).not.toContain('readFile')
  })
})

describe('DesktopPlatform.openDroppedFolder', () => {
  it('attaches a dropped folder as the workspace root', async () => {
    const { platform, calls } = await createPlatform({
      attachAnyRoot: true,
      filePath: 'C:\\Docs\\Vault',
    })

    const result = await platform.openDroppedFolder(new File(['ignored'], 'Vault'))

    expect(result?.workspace).toEqual({
      id: 'desktop:C:\\Docs\\Vault',
      name: 'Vault',
      rootPath: 'C:\\Docs\\Vault',
    })
    expect(calls).toContainEqual({ method: 'restoreWorkspace', args: ['C:\\Docs\\Vault'] })
    expect(platform.getWorkspace()?.rootPath).toBe('C:\\Docs\\Vault')
  })

  it('returns null without calling the bridge when the path is unresolvable', async () => {
    const { platform, calls } = await createPlatform({ filePath: null })

    expect(await platform.openDroppedFolder(new File(['ignored'], 'Vault'))).toBeNull()
    expect(calls.map((call) => call.method)).not.toContain('restoreWorkspace')
  })
})

describe('DesktopPlatform pending open files', () => {
  it('takes queued paths from the bridge', async () => {
    const { platform } = await createPlatform({ openFiles: ['C:\\Notes\\a.md'] })

    expect(await platform.takeOpenFiles()).toEqual(['C:\\Notes\\a.md'])
  })

  it('subscribes and unsubscribes to open-file notifications', async () => {
    const { platform, openFileListeners } = await createPlatform()
    const listener = () => undefined

    const dispose = platform.onOpenFiles(listener)
    expect(openFileListeners.has(listener)).toBe(true)

    dispose()
    expect(openFileListeners.has(listener)).toBe(false)
  })
})

describe('DesktopPlatform workspace directories', () => {
  it('lists one directory at a time and scopes watches to requested folders', async () => {
    const { platform, calls } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
    })

    await platform.listWorkspaceDirectory('notes')
    await platform.findWorkspaceFiles('note', 20)
    platform.setWorkspaceWatchDirectories(['', 'notes'])

    expect(calls).toContainEqual({
      method: 'listWorkspaceDirectory',
      args: ['notes'],
    })
    expect(calls).toContainEqual({
      method: 'findWorkspaceFiles',
      args: ['note', 20],
    })
    expect(calls).toContainEqual({
      method: 'setWatchDirectories',
      args: [['', 'notes']],
    })
  })

  it('maps workspace paths back to absolute paths for file watches', async () => {
    const { platform } = await createPlatform({
      workspace: { id: 'ws-1', name: 'Vault', rootPath: 'C:\\Docs\\Vault' },
    })
    expect(platform.workspaceAbsolutePath('notes/a.md')).toBe('C:\\Docs\\Vault\\notes\\a.md')
  })

  it('has no absolute path mapping without an open workspace', async () => {
    const { platform } = await createPlatform()
    expect(platform.workspaceAbsolutePath('notes/a.md')).toBeNull()
  })
})

describe('DesktopPlatform.watchDocument', () => {
  it('starts a single-file watch and forwards only matching paths', async () => {
    const { platform, calls, documentListeners } = await createPlatform()
    const onEvent = vi.fn()

    const dispose = platform.watchDocument('C:\\Notes\\a.md', onEvent)

    expect(calls).toContainEqual({
      method: 'startFileWatch',
      args: ['C:\\Notes\\a.md'],
    })
    expect(documentListeners.size).toBe(1)

    for (const listener of documentListeners) {
      listener([
        { type: 'change', path: 'c:/notes/A.MD' },
        { type: 'change', path: 'C:\\Notes\\b.md' },
      ])
    }
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ type: 'change', path: 'c:/notes/A.MD' })

    dispose()
    expect(calls).toContainEqual({
      method: 'stopFileWatch',
      args: ['C:\\Notes\\a.md'],
    })
    expect(documentListeners.size).toBe(0)
  })

  it('keeps POSIX paths case-sensitive', async () => {
    const { platform, documentListeners } = await createPlatform({ platform: 'linux' })
    const onEvent = vi.fn()

    platform.watchDocument('/home/me/notes/a.md', onEvent)
    for (const listener of documentListeners) {
      listener([
        { type: 'change', path: '/home/me/Notes/a.md' },
        { type: 'change', path: '/home/me/notes/a.md' },
      ])
    }

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({
      type: 'change',
      path: '/home/me/notes/a.md',
    })
  })
})
