import {
  DESKTOP_DOCUMENT_EVENTS_CHANNEL,
  type DocumentChangeEvent,
} from '@notadown/shared'
import { watch, type FSWatcher } from 'chokidar'
import type { BrowserWindow } from 'electron'
import path from 'node:path'

const watched = new Map<string, FSWatcher>()
let watcherWindow: BrowserWindow | null = null
let pendingEvents: DocumentChangeEvent[] = []
let flushTimer: NodeJS.Timeout | null = null

export function startFileWatch(absolutePath: string, window: BrowserWindow): void {
  const target = requireAbsolutePath(absolutePath)
  if (watcherWindow !== window) {
    watcherWindow = window
    window.once('closed', () => {
      if (watcherWindow === window) stopAllFileWatches()
    })
  }

  const key = fileKey(target)
  if (watched.has(key)) return

  const active = watch(target, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  })
  active.on('all', (eventName) => {
    if (eventName !== 'change' && eventName !== 'add' && eventName !== 'unlink') return
    queueEvent({ type: eventName, path: target })
  })
  active.on('error', () => undefined)
  watched.set(key, active)
}

export function stopFileWatch(absolutePath: string): void {
  const key = fileKey(absolutePath)
  const active = watched.get(key)
  if (!active) return
  watched.delete(key)
  void active.close()
}

export function stopAllFileWatches(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  pendingEvents = []
  watcherWindow = null
  for (const active of watched.values()) void active.close()
  watched.clear()
}

function queueEvent(event: DocumentChangeEvent): void {
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
  window.webContents.send(DESKTOP_DOCUMENT_EVENTS_CHANNEL, events)
}

function fileKey(absolutePath: string): string {
  const resolved = path.resolve(absolutePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function requireAbsolutePath(absolutePath: string): string {
  if (!absolutePath || !path.isAbsolute(absolutePath)) throw new Error('INVALID_PATH')
  return absolutePath
}
