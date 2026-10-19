import type { EditorCommand, FindResult } from '@notadown/editor'

export interface EditorHandle {
  focus(): void
  find(query: string, forward?: boolean): FindResult | null
  clearFind(): void
  goToPosition(pos: number): void
  runCommand(command: EditorCommand): boolean
  setFocusMode(value: boolean): void
  setTypewriterMode(value: boolean): void
  setReadOnly(value: boolean): void
  refreshLayout(): void
}

const handles = new Map<string, EditorHandle>()

export function registerEditor(key: string, handle: EditorHandle): () => void {
  handles.set(key, handle)
  return () => {
    if (handles.get(key) === handle) handles.delete(key)
  }
}

export function getEditor(key: string | null): EditorHandle | null {
  if (!key) return null
  return handles.get(key) ?? null
}

export function focusEditor(key: string | null): void {
  getEditor(key)?.focus()
}

export function refreshEditors(): void {
  for (const handle of handles.values()) handle.refreshLayout()
}
