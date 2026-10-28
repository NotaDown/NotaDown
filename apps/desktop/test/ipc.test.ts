import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_INVOKE_CHANNEL, type AppSettings } from '@notadown/shared'

const mocks = vi.hoisted(() => ({
  electron: {
    handle: vi.fn(),
    fromWebContents: vi.fn(),
    openExternal: vi.fn(async () => undefined),
    getVersion: vi.fn(() => '1.2.3'),
  },
  workspace: {
    openWorkspace: vi.fn(async () => null),
    restoreWorkspace: vi.fn(async () => null),
    closeWorkspace: vi.fn(),
    listWorkspaceDirectory: vi.fn(async () => []),
    findWorkspaceFiles: vi.fn(async () => []),
    setWatchDirectories: vi.fn(),
    readWorkspaceFile: vi.fn(async () => ({ content: '', mtime: 1 })),
    writeWorkspaceFile: vi.fn(async () => ({ mtime: 1 })),
    createWorkspaceFile: vi.fn(async () => undefined),
    createWorkspaceDirectory: vi.fn(async () => undefined),
    renameWorkspaceEntry: vi.fn(async () => undefined),
    moveWorkspaceEntry: vi.fn(async () => undefined),
    deleteWorkspaceEntry: vi.fn(async () => undefined),
    revealWorkspaceEntry: vi.fn(async () => undefined),
    openFileDialog: vi.fn(async () => null),
    readAbsoluteFile: vi.fn(async () => ({ content: '', mtime: 1 })),
    writeAbsoluteFile: vi.fn(async () => ({ mtime: 1 })),
    saveFileDialog: vi.fn(async () => null),
    statFile: vi.fn(async () => null),
    writeImageFile: vi.fn(async () => 'asset://file'),
    readAsset: vi.fn(async () => ({ data: new Uint8Array(), mime: 'image/png' })),
    searchWorkspace: vi.fn(async () => []),
    startWatch: vi.fn(),
  },
  documentWatch: {
    startFileWatch: vi.fn(),
    stopFileWatch: vi.fn(),
  },
  history: {
    saveHistory: vi.fn(async () => null),
    listHistory: vi.fn(async () => []),
    readHistory: vi.fn(async () => null),
    deleteHistory: vi.fn(async () => undefined),
    clearHistory: vi.fn(async () => undefined),
    historyDir: vi.fn(() => 'C:/Users/me/AppData/Roaming/NotaDown/history'),
    openHistoryDir: vi.fn(async () => undefined),
  },
  state: {
    loadSettings: vi.fn(async () => null),
    saveSettings: vi.fn(async () => undefined),
    loadSession: vi.fn(async () => null),
    saveSession: vi.fn(async () => undefined),
  },
  exporter: {
    exportHtml: vi.fn(async () => undefined),
    exportPdf: vi.fn(async () => undefined),
  },
  chrome: {
    getWindowChrome: vi.fn(() => ({ titleBarMode: 'native' as const })),
    updateOverlayColors: vi.fn(),
  },
  openFiles: {
    takeOpenFiles: vi.fn(() => ['C:/docs/a.md']),
  },
}))

vi.mock('electron', () => ({
  app: { getVersion: mocks.electron.getVersion },
  BrowserWindow: { fromWebContents: mocks.electron.fromWebContents },
  ipcMain: { handle: mocks.electron.handle },
  shell: { openExternal: mocks.electron.openExternal },
}))
vi.mock('../src/workspace', () => mocks.workspace)
vi.mock('../src/document-watch', () => mocks.documentWatch)
vi.mock('../src/history', () => mocks.history)
vi.mock('../src/state', () => mocks.state)
vi.mock('../src/export', () => mocks.exporter)
vi.mock('../src/chrome', () => mocks.chrome)
vi.mock('../src/open-files', () => mocks.openFiles)

import { registerIpcHandlers } from '../src/ipc'

type Handler = (event: unknown, method: string, ...args: unknown[]) => Promise<unknown>

const window = { id: 1 }
let handler: Handler

function invoke(method: string, ...args: unknown[]): Promise<unknown> {
  return handler({ sender: {} }, method, ...args)
}

async function withPlatform(platform: string, run: () => Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  try {
    await run()
  } finally {
    if (descriptor) Object.defineProperty(process, 'platform', descriptor)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.electron.fromWebContents.mockReturnValue(window)
  registerIpcHandlers()
  handler = mocks.electron.handle.mock.calls.at(-1)?.[1] as Handler
})

describe('registerIpcHandlers', () => {
  it('registers a single invoke channel', () => {
    expect(mocks.electron.handle).toHaveBeenCalledWith(
      DESKTOP_INVOKE_CHANNEL,
      expect.any(Function),
    )
  })

  it('routes app queries', async () => {
    await expect(invoke('getVersion')).resolves.toBe('1.2.3')
    await expect(invoke('getPlatform')).resolves.toBe(process.platform)
  })

  it('passes the sender window to dialog-backed methods', async () => {
    mocks.electron.fromWebContents.mockReturnValueOnce(window)
    await invoke('openWorkspace')
    expect(mocks.workspace.openWorkspace).toHaveBeenCalledWith(window)

    await invoke('saveFileDialog', 'a.md', 'body')
    expect(mocks.workspace.saveFileDialog).toHaveBeenCalledWith(window, 'a.md', 'body', null)

    await invoke('startWatch')
    expect(mocks.workspace.startWatch).toHaveBeenCalledWith(window)

    await invoke('setWatchDirectories', ['', 'notes'])
    expect(mocks.workspace.setWatchDirectories).toHaveBeenCalledWith(['', 'notes'])

    await invoke('startFileWatch', 'C:/notes/a.md')
    expect(mocks.documentWatch.startFileWatch).toHaveBeenCalledWith('C:/notes/a.md', window)

    await invoke('stopFileWatch', 'C:/notes/a.md')
    expect(mocks.documentWatch.stopFileWatch).toHaveBeenCalledWith('C:/notes/a.md')
  })

  it('rejects starting a file watcher without a window', async () => {
    mocks.electron.fromWebContents.mockReturnValueOnce(null)
    await expect(invoke('startFileWatch', 'C:/notes/a.md')).rejects.toThrow('NO_WINDOW')
    expect(mocks.documentWatch.startFileWatch).not.toHaveBeenCalled()
  })

  it('coerces arguments for workspace writes', async () => {
    await invoke('writeWorkspaceFile', 'notes/a.md', 'hello')
    expect(mocks.workspace.writeWorkspaceFile).toHaveBeenCalledWith('notes/a.md', 'hello')

    await invoke('renameWorkspaceEntry', 'a.md', 'b.md')
    expect(mocks.workspace.renameWorkspaceEntry).toHaveBeenCalledWith('a.md', 'b.md')
  })

  it('routes directory listing and file lookup', async () => {
    await invoke('listWorkspaceDirectory', 'notes')
    expect(mocks.workspace.listWorkspaceDirectory).toHaveBeenCalledWith('notes')

    await invoke('findWorkspaceFiles', 'note', 20)
    expect(mocks.workspace.findWorkspaceFiles).toHaveBeenCalledWith('note', 20)
  })

  it('rejects starting a watcher without a window', async () => {
    mocks.electron.fromWebContents.mockReturnValueOnce(null)
    await expect(invoke('startWatch')).rejects.toThrow('NO_WINDOW')
    expect(mocks.workspace.startWatch).not.toHaveBeenCalled()
  })

  it('persists settings and notifies the caller', async () => {
    const settings = { locale: 'zh-CN', theme: 'dark' } as AppSettings
    const onSaved = vi.fn()
    registerIpcHandlers(onSaved)
    handler = mocks.electron.handle.mock.calls.at(-1)?.[1] as Handler

    await invoke('saveSettings', settings)
    expect(mocks.state.saveSettings).toHaveBeenCalledWith(settings)
    expect(onSaved).toHaveBeenCalledWith(settings)
  })

  it('recreates the window when requested', async () => {
    const recreate = vi.fn()
    registerIpcHandlers(undefined, recreate)
    handler = mocks.electron.handle.mock.calls.at(-1)?.[1] as Handler

    await expect(invoke('recreateWindow')).resolves.toBeUndefined()
    expect(recreate).toHaveBeenCalledOnce()
  })

  it('normalizes filesystem errors', async () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' })
    mocks.workspace.readWorkspaceFile.mockRejectedValueOnce(error)
    await expect(invoke('readWorkspaceFile', 'a.md')).rejects.toThrow('NOT_FOUND')

    mocks.workspace.readAbsoluteFile.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'EACCES' }),
    )
    await expect(invoke('readFile', 'C:/a.md')).rejects.toThrow('PERMISSION_DENIED')
  })

  it('rejects unknown methods', async () => {
    await expect(invoke('nope')).rejects.toThrow('UNSUPPORTED')
  })

  it('only opens http, https and mailto links externally', async () => {
    await invoke('openExternal', 'https://example.com')
    expect(mocks.electron.openExternal).toHaveBeenCalledWith('https://example.com')

    await expect(invoke('openExternal', 'javascript:alert(1)')).rejects.toThrow(
      'UNSUPPORTED',
    )
    expect(mocks.electron.openExternal).toHaveBeenCalledTimes(1)
  })

  it('opens the Windows default apps page for this app', async () => {
    await withPlatform('win32', async () => {
      await expect(invoke('openDefaultAppSettings')).resolves.toBeUndefined()
      expect(mocks.electron.openExternal).toHaveBeenCalledWith(
        'ms-settings:defaultapps?registeredAppUser=NotaDown',
      )
    })
  })

  it('rejects default app settings on other platforms', async () => {
    await withPlatform('darwin', async () => {
      await expect(invoke('openDefaultAppSettings')).rejects.toThrow('UNSUPPORTED')
      expect(mocks.electron.openExternal).not.toHaveBeenCalled()
    })
  })

  it('returns queued files', async () => {
    await expect(invoke('takeOpenFiles')).resolves.toEqual(['C:/docs/a.md'])
    expect(mocks.openFiles.takeOpenFiles).toHaveBeenCalledOnce()
  })

  it('exposes and opens the local history directory', async () => {
    await expect(invoke('historyDir')).resolves.toBe(
      'C:/Users/me/AppData/Roaming/NotaDown/history',
    )
    await expect(invoke('openHistoryDir')).resolves.toBeUndefined()
    expect(mocks.history.openHistoryDir).toHaveBeenCalledOnce()
  })
})
