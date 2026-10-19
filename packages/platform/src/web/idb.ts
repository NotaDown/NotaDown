import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { HistoryRecord } from '@notadown/shared'

export interface StoredHistory extends HistoryRecord {
  content: string
}

interface NotaDownDB extends DBSchema {
  kv: {
    key: string
    value: unknown
  }
  history: {
    key: string
    value: StoredHistory
    indexes: {
      'by-document': string
      'by-created': number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<NotaDownDB>> | null = null

export function getDb(): Promise<IDBPDatabase<NotaDownDB>> {
  dbPromise ??= openDB<NotaDownDB>('notadown-web', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('history')) {
        const store = db.createObjectStore('history', { keyPath: 'id' })
        store.createIndex('by-document', 'documentKey')
        store.createIndex('by-created', 'createdAt')
      }
    },
  })
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb()
  const value = await db.get('kv', key)
  return (value as T | undefined) ?? null
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('kv', value, key)
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('kv', key)
}
