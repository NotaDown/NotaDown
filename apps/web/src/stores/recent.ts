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

export interface RecentFolder {
  key: string
  name: string
  path: string | null
  workspace: WorkspaceInfo
  openedAt: number
}

const DOCUMENTS_KEY = 'notadown:recent'
const FOLDERS_KEY = 'notadown:recent-folders'
const MAX_RECENT = 10

export const useRecentStore = defineStore('recent', () => {
  const documents = ref<RecentDocument[]>(loadDocuments())
  const folders = ref<RecentFolder[]>(loadFolders())

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
    persist(DOCUMENTS_KEY, next)
  }

  function recordFolder(workspace: WorkspaceInfo): void {
    const entry: RecentFolder = {
      key: workspace.id,
      name: workspace.name,
      path: workspace.rootPath,
      workspace: { ...workspace },
      openedAt: Date.now(),
    }
    const next = [entry, ...folders.value.filter((item) => item.key !== entry.key)].slice(
      0,
      MAX_RECENT,
    )
    folders.value = next
    persist(FOLDERS_KEY, next)
  }

  function remove(key: string): void {
    documents.value = documents.value.filter((item) => item.key !== key)
    persist(DOCUMENTS_KEY, documents.value)
  }

  function removeFolder(key: string): void {
    folders.value = folders.value.filter((item) => item.key !== key)
    persist(FOLDERS_KEY, folders.value)
  }

  function clear(): void {
    documents.value = []
    folders.value = []
    persist(DOCUMENTS_KEY, [])
    persist(FOLDERS_KEY, [])
  }

  return { documents, folders, record, recordFolder, remove, removeFolder, clear }
})

function loadDocuments(): RecentDocument[] {
  return load(DOCUMENTS_KEY, isRecentDocument)
}

function loadFolders(): RecentFolder[] {
  return load(FOLDERS_KEY, isRecentFolder)
}

function load<T>(key: string, guard: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(guard).slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

function persist(key: string, entries: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries))
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

function isRecentFolder(value: unknown): value is RecentFolder {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  const workspace = entry.workspace as WorkspaceInfo | undefined
  return (
    typeof entry.key === 'string' &&
    typeof entry.name === 'string' &&
    (entry.path === null || typeof entry.path === 'string') &&
    typeof entry.openedAt === 'number' &&
    workspace !== undefined &&
    isWorkspaceInfo(workspace)
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
