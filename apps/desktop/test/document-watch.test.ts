import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_DOCUMENT_EVENTS_CHANNEL } from '@notadown/shared'
import type { BrowserWindow } from 'electron'
import {
  startFileWatch,
  stopAllFileWatches,
  stopFileWatch,
} from '../src/document-watch'

const tempDirs: string[] = []

afterEach(async () => {
  stopAllFileWatches()
  for (const directory of tempDirs.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

async function createTempFile(name: string, content: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'notadown-watch-'))
  tempDirs.push(directory)
  const file = path.join(directory, name)
  await writeFile(file, content, 'utf8')
  return file
}

function createWindow() {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
    once: vi.fn(),
  } as unknown as BrowserWindow & { webContents: { send: ReturnType<typeof vi.fn> } }
}

async function waitFor(check: () => boolean, timeout = 4000): Promise<void> {
  const startedAt = Date.now()
  while (!check()) {
    if (Date.now() - startedAt > timeout) throw new Error('Timed out waiting for event')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('document watch', () => {
  it('forwards change events for a watched file', async () => {
    const file = await createTempFile('note.md', 'v1')
    const window = createWindow()
    startFileWatch(file, window)
    await delay(250)

    await writeFile(file, 'v2', 'utf8')

    await waitFor(() => window.webContents.send.mock.calls.length > 0)
    const [channel, events] = window.webContents.send.mock.calls[0]
    expect(channel).toBe(DESKTOP_DOCUMENT_EVENTS_CHANNEL)
    expect(events).toEqual([{ type: 'change', path: file }])
  })

  it('stops sending events after the watch is released', async () => {
    const file = await createTempFile('note.md', 'v1')
    const window = createWindow()
    startFileWatch(file, window)
    await delay(250)
    stopFileWatch(file)
    await delay(150)

    await writeFile(file, 'v2', 'utf8')
    await delay(700)

    expect(window.webContents.send).not.toHaveBeenCalled()
  })

  it('keeps watching after an atomic replace', async () => {
    const file = await createTempFile('note.md', 'v1')
    const window = createWindow()
    startFileWatch(file, window)
    await delay(250)

    const replacement = `${file}.tmp`
    await writeFile(replacement, 'v2', 'utf8')
    await rename(replacement, file)
    await waitFor(() => window.webContents.send.mock.calls.length > 0)

    window.webContents.send.mockClear()
    await writeFile(file, 'v3', 'utf8')
    await waitFor(() => window.webContents.send.mock.calls.length > 0)
  })
})
