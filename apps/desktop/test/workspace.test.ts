import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

const chokidar = vi.hoisted(() => {
  const instance = {
    add: vi.fn(),
    unwatch: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    on: vi.fn(),
  }
  instance.on.mockReturnValue(instance)
  return {
    instance,
    watch: vi.fn(() => instance),
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class {},
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: '' })),
  },
  shell: { showItemInFolder: vi.fn() },
}))
vi.mock('chokidar', () => ({ watch: chokidar.watch }))

import * as workspace from '../src/workspace'

let root: string

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'notadown-workspace-'))
  await mkdir(path.join(root, 'notes', 'sub'), { recursive: true })
  await mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true })
  await writeFile(path.join(root, 'README.md'), '# Readme\n')
  await writeFile(path.join(root, '.hidden.md'), '# Hidden\n')
  await writeFile(path.join(root, 'notes', 'a.md'), '# A\n')
  await writeFile(path.join(root, 'notes', 'sub', 'b.md'), '# B\n')
  await writeFile(path.join(root, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1\n')
})

afterAll(async () => {
  workspace.closeWorkspace()
  await rm(root, { recursive: true, force: true })
})

beforeEach(() => {
  chokidar.watch.mockClear()
  chokidar.instance.add.mockClear()
  chokidar.instance.unwatch.mockClear()
  chokidar.instance.on.mockClear()
})

describe('workspace directory loading', () => {
  it('returns only the direct children of the opened folder', async () => {
    const result = await workspace.restoreWorkspace(root)
    expect(result?.entries.map((entry) => entry.path)).toEqual([
      'node_modules',
      'notes',
      'README.md',
    ])
  })

  it('lists a nested directory on demand', async () => {
    await workspace.restoreWorkspace(root)
    const entries = await workspace.listWorkspaceDirectory('notes')
    expect(entries.map((entry) => entry.path)).toEqual(['notes/a.md', 'notes/sub'])
  })

  it('rejects paths outside the workspace', async () => {
    await workspace.restoreWorkspace(root)
    await expect(workspace.listWorkspaceDirectory('../')).rejects.toThrow('INVALID_PATH')
  })
})

describe('workspace file index', () => {
  it('matches files while skipping dependency folders', async () => {
    await workspace.restoreWorkspace(root)
    const files = await workspace.findWorkspaceFiles('', 50)
    const paths = files.map((entry) => entry.path)

    expect(paths).toContain('notes/a.md')
    expect(paths).toContain('notes/sub/b.md')
    expect(paths).not.toContain('node_modules/pkg/index.js')
    expect(paths).not.toContain('.hidden.md')
  })

  it('fuzzy matches paths', async () => {
    await workspace.restoreWorkspace(root)
    const files = await workspace.findWorkspaceFiles('subb', 10)
    expect(files[0]?.path).toBe('notes/sub/b.md')
  })
})

describe('workspace watching', () => {
  it('watches the root non-recursively and adds expanded folders', async () => {
    await workspace.restoreWorkspace(root)
    workspace.startWatch({} as BrowserWindow)

    expect(chokidar.watch).toHaveBeenCalledWith(
      root,
      expect.objectContaining({ depth: 0, ignoreInitial: true }),
    )

    workspace.setWatchDirectories(['', 'notes', 'notes/sub'])
    expect(chokidar.instance.add).toHaveBeenCalledWith(path.join(root, 'notes'))
    expect(chokidar.instance.add).toHaveBeenCalledWith(path.join(root, 'notes', 'sub'))

    workspace.setWatchDirectories(['', 'notes'])
    expect(chokidar.instance.unwatch).toHaveBeenCalledWith(path.join(root, 'notes', 'sub'))
  })

  it('forwards structural events and ignores content changes', async () => {
    await workspace.restoreWorkspace(root)
    const send = vi.fn()
    const window = {
      webContents: { send },
      isDestroyed: () => false,
    }
    workspace.startWatch(window as unknown as BrowserWindow)

    const handler = chokidar.instance.on.mock.calls.find(
      ([name]) => name === 'all',
    )?.[1] as (name: string, changedPath: string) => void
    handler('change', path.join(root, 'README.md'))
    handler('add', path.join(root, 'added.md'))

    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).toEqual([
      { type: 'add', path: 'added.md', isDirectory: false },
    ])
  })
})
