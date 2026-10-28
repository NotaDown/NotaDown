import { app, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  createId,
  type HistoryDetail,
  type HistoryOptions,
  type HistoryRecord,
  type HistorySnapshotInput,
} from '@notadown/shared'

interface HistoryIndex {
  records: HistoryRecord[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const ID_PATTERN = /^history-[A-Za-z0-9-]+$/

let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

export function historyDir(): string {
  return path.join(app.getPath('userData'), 'history')
}

function contentDir(): string {
  return path.join(historyDir(), 'content')
}

function indexFile(): string {
  return path.join(historyDir(), 'index.json')
}

function contentFile(id: string): string {
  return path.join(contentDir(), `${id}.txt`)
}

function isRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<HistoryRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.documentKey === 'string' &&
    typeof record.fileName === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.size === 'number'
  )
}

async function readIndex(): Promise<HistoryRecord[]> {
  try {
    const raw = await fs.readFile(indexFile(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<HistoryIndex>
    return Array.isArray(parsed.records) ? parsed.records.filter(isRecord) : []
  } catch {
    return []
  }
}

async function writeIndex(records: HistoryRecord[]): Promise<void> {
  await fs.mkdir(historyDir(), { recursive: true })
  const target = indexFile()
  const temp = `${target}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify({ records }, null, 2), 'utf8')
  await fs.rename(temp, target)
}

export function saveHistory(
  input: HistorySnapshotInput,
  options: HistoryOptions,
): Promise<HistoryRecord> {
  return enqueue(async () => {
    const record: HistoryRecord = {
      id: createId('history'),
      documentKey: input.documentKey,
      filePath: input.filePath,
      fileName: input.fileName,
      createdAt: Date.now(),
      source: input.source,
      size: Buffer.byteLength(input.content, 'utf8'),
    }

    await fs.mkdir(contentDir(), { recursive: true })
    await fs.writeFile(contentFile(record.id), input.content, 'utf8')

    const records = await readIndex()
    records.push(record)

    const cutoff = Date.now() - Math.max(0, options.retentionDays) * DAY_MS
    const maxPerFile = Math.max(0, options.maxPerFile)
    const byDocument = new Map<string, HistoryRecord[]>()
    for (const item of records) {
      const list = byDocument.get(item.documentKey)
      if (list) list.push(item)
      else byDocument.set(item.documentKey, [item])
    }

    const kept: HistoryRecord[] = []
    const removed: HistoryRecord[] = []
    for (const list of byDocument.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt)
      list.forEach((item, index) => {
        if (index < maxPerFile && item.createdAt >= cutoff) kept.push(item)
        else removed.push(item)
      })
    }

    kept.sort((a, b) => b.createdAt - a.createdAt)
    await writeIndex(kept)
    await Promise.all(removed.map((item) => fs.rm(contentFile(item.id), { force: true })))

    return record
  })
}

export function listHistory(documentKey?: string): Promise<HistoryRecord[]> {
  return enqueue(async () => {
    const records = await readIndex()
    return records
      .filter((record) => !documentKey || record.documentKey === documentKey)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 1000)
  })
}

export function readHistory(id: string): Promise<HistoryDetail | null> {
  return enqueue(async () => {
    if (!ID_PATTERN.test(id)) return null
    const records = await readIndex()
    const record = records.find((item) => item.id === id)
    if (!record) return null
    try {
      const content = await fs.readFile(contentFile(id), 'utf8')
      return { record, content }
    } catch {
      await writeIndex(records.filter((item) => item.id !== id))
      return null
    }
  })
}

export function deleteHistory(id: string): Promise<void> {
  return enqueue(async () => {
    if (!ID_PATTERN.test(id)) return
    const records = await readIndex()
    const next = records.filter((item) => item.id !== id)
    if (next.length !== records.length) await writeIndex(next)
    await fs.rm(contentFile(id), { force: true })
  })
}

export function clearHistory(): Promise<void> {
  return enqueue(async () => {
    await fs.rm(contentDir(), { recursive: true, force: true })
    await fs.rm(indexFile(), { force: true })
  })
}

export async function openHistoryDir(): Promise<void> {
  const dir = historyDir()
  await fs.mkdir(dir, { recursive: true })
  const failure = await shell.openPath(dir)
  if (failure) throw new Error('OPEN_FAILED')
}
