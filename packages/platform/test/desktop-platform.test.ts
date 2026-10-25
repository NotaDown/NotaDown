import { describe, expect, it } from 'vitest'
import type { DesktopBridge, WorkspaceInfo } from '@notadown/shared'
import { DesktopPlatform } from '../src/desktop/desktop-platform'

interface BridgeOptions {
  workspace?: WorkspaceInfo
  filePath?: string | null
  files?: Record<string, string>
  openFiles?: string[]
}

function createBridge(options: BridgeOptions = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const openFileListeners = new Set<() => void>()

  const bridge = {
    invoke: async (method: string, ...args: unknown[]) => {
      calls.push({ method, args })
      switch (method) {
        case 'openWorkspace':
        case 'restoreWorkspace':
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
    onMenuCommand: () => () => undefined,
    onOpenFiles: (callback: () => void) => {
      openFileListeners.add(callback)
      return () => openFileListeners.delete(callback)
    },
    platform: 'win32',
  } as unknown as DesktopBridge

  return { bridge, calls, openFileListeners }
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
