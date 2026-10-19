import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { DocumentOrigin, DocumentRef, WorkspaceInfo } from '@notadown/shared'
import { platform } from '@/platform'

export interface RecentDocument {
  key: string
  name: string
  path: string | null
  origin: Exclude<DocumentOrigin, 'untitled'>
  workspaceId: string | null
  workspace: WorkspaceInfo | null
  openedAt: number
}

const STORAGE_KEY = 'notadown:recent'
const MAX_RECENT = 10

export const useRecentStore = defineStore('recent', () => {
  const documents = ref<RecentDocument[]>(load())

  function record(ref: DocumentRef): void {
    if (ref.origin === 'untitled' || !ref.path) return
    const workspace = platform.getWorkspace()
    const entry: RecentDocument = {
      key: ref.key,
      name: ref.name,
      path: ref.path,
      origin: ref.origin,
      workspaceId: workspace?.id ?? null,
      workspace: workspace ? { ...workspace } : null,
      openedAt: Date.now(),
    }
    const next = [entry, ...documents.value.filter((item) => item.key !== entry.key)].slice(
      0,
      MAX_RECENT,
    )
    documents.value = next
    persist(next)
  }

  function remove(key: string): void {
    documents.value = documents.value.filter((item) => item.key !== key)
    persist(documents.value)
  }

  function clear(): void {
    documents.value = []
    persist([])
  }

  return { documents, record, remove, clear }
})

function load(): RecentDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentDocument).slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

function persist(documents: RecentDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents))
  } catch {
    // Storage can be unavailable in private browsing; recents are optional.
  }
}

function isRecentDocument(value: unknown): value is RecentDocument {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  const workspace = entry.workspace as WorkspaceInfo | null | undefined
  return (
    typeof entry.key === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.path === 'string' &&
    (entry.origin === 'file' || entry.origin === 'workspace') &&
    (workspace === null || workspace === undefined || isWorkspaceInfo(workspace)) &&
    typeof entry.openedAt === 'number'
  )
}

function isWorkspaceInfo(value: WorkspaceInfo): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.rootPath === null || typeof value.rootPath === 'string')
  )
}
