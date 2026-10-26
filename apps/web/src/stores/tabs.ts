import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createId,
  ensureMarkdownExtension,
  isOpenableTextFile,
  LARGE_DOCUMENT_THRESHOLD,
  normalizeSlashes,
  type DocumentRef,
  type HistoryOptions,
  type HistorySource,
  type OpenedDocument,
  type OutlineItem,
  type SessionTab,
} from '@notadown/shared'
import { i18n } from '@/i18n'
import { platform } from '@/platform'
import { describeError, errorCode } from '@/errors'
import { flushEditor, focusEditor } from '@/editor-registry'
import { useSettingsStore } from './settings'
import { useUiStore } from './ui'
import { useRecentStore, type RecentDocument } from './recent'
import { useWorkspaceStore } from './workspace'

export type TabViewMode = 'rich' | 'source'

export interface EditorTab {
  key: string
  ref: DocumentRef
  name: string
  content: string
  savedContent: string
  mtime: number | null
  saving: boolean
  loading: boolean
  missing: boolean
  conflict: boolean
  pendingDiskContent: string | null
  viewMode: TabViewMode
  outline: OutlineItem[]
  reloadToken: number
  downloadOnly: boolean
  lastSnapshotAt: number
  lastSnapshotContent: string
}

const t = i18n.global.t

export const useTabsStore = defineStore('tabs', () => {
  const settings = useSettingsStore()
  const ui = useUiStore()
  const recent = useRecentStore()

  const tabs = ref<EditorTab[]>([])
  const activeKey = ref<string | null>(null)

  const autosaveTimers = new Map<string, number>()
  const documentWatchers = new Map<string, () => void>()
  const snapshotting = new Set<string>()

  const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeKey.value) ?? null)
  const activeDocumentKey = computed(() => activeTab.value?.ref.key ?? null)
  const hasDirty = computed(() => tabs.value.some((tab) => isDirty(tab)))

  function isDirty(tab: EditorTab): boolean {
    return tab.content !== tab.savedContent
  }

  function findTab(key: string | null): EditorTab | null {
    if (!key) return null
    return tabs.value.find((tab) => tab.key === key) ?? null
  }

  function findByRef(ref: DocumentRef): EditorTab | null {
    return (
      tabs.value.find(
        (tab) =>
          tab.ref.origin === ref.origin && sameDocumentKey(tab.ref.key, ref.key),
      ) ?? null
    )
  }

  function activate(key: string): void {
    if (!tabs.value.some((tab) => tab.key === key)) return
    activeKey.value = key
    const tab = findTab(key)
    if (tab?.ref.origin === 'workspace' && tab.ref.path) {
      const workspace = useWorkspaceStore()
      workspace.select(tab.ref.path)
      workspace.expandPath(tab.ref.path)
    }
    window.requestAnimationFrame(() => focusEditor(key))
  }

  function createUntitled(): EditorTab {
    const existing = tabs.value.find(
      (tab) => tab.ref.origin === 'untitled' && !isDirty(tab) && !tab.loading,
    )
    if (existing) {
      activate(existing.key)
      return existing
    }
    const name = ensureMarkdownExtension(t('app.untitled'), settings.settings.defaultFileExtension)
    const ref: DocumentRef = {
      key: createId('untitled'),
      name,
      path: null,
      origin: 'untitled',
    }
    return addTab(ref, '', null)
  }

  function addTab(ref: DocumentRef, content: string, mtime: number | null): EditorTab {
    const largeDocument =
      ref.origin !== 'untitled' && content.length >= LARGE_DOCUMENT_THRESHOLD
    const tab: EditorTab = {
      key: createId('tab'),
      ref,
      name: ref.name,
      content,
      savedContent: content,
      mtime,
      saving: false,
      loading: false,
      missing: false,
      conflict: false,
      pendingDiskContent: null,
      viewMode: largeDocument ? 'source' : 'rich',
      outline: [],
      reloadToken: 0,
      downloadOnly: false,
      lastSnapshotAt: Date.now(),
      lastSnapshotContent: content,
    }
    tabs.value.push(tab)
    activeKey.value = tab.key
    watchDocumentTab(tab)
    if (ref.origin !== 'untitled') recent.record(ref)
    if (largeDocument) {
      ui.toast('info', t('editor.largeDocument'), tab.name, 5000)
    }
    window.requestAnimationFrame(() => focusEditor(tab.key))
    return tab
  }

  function addOpenedDocument(opened: OpenedDocument): EditorTab {
    const ref = canonicalDocumentRef(opened.ref)
    const existing = findByRef(ref)
    if (existing) {
      activate(existing.key)
      return existing
    }
    return addTab(ref, opened.content, opened.mtime)
  }

  async function openRef(
    target: DocumentRef,
    options: { silent?: boolean } = {},
  ): Promise<EditorTab | null> {
    const ref = canonicalDocumentRef(target)
    const existing = findByRef(ref)
    if (existing) {
      activate(existing.key)
      return existing
    }
    try {
      const opened = await platform.readDocument(ref)
      const concurrent = findByRef(ref)
      if (concurrent) {
        activate(concurrent.key)
        return concurrent
      }
      const tab = addTab(opened.ref, opened.content, opened.mtime)
      if (ref.origin === 'workspace' && ref.path) {
        const workspace = useWorkspaceStore()
        workspace.select(ref.path)
        workspace.expandPath(ref.path)
      }
      return tab
    } catch (error) {
      if (!options.silent) {
        ui.toast('error', t('toasts.openFailed'), describeError(error))
      }
      return null
    }
  }

  async function openWorkspaceFile(
    path: string,
    options: { silent?: boolean } = {},
  ): Promise<EditorTab | null> {
    if (!platform.getWorkspace()) return null
    return openRef(platform.workspaceDocumentRef(path), options)
  }

  async function openFileDialog(): Promise<EditorTab | null> {
    try {
      const opened = await platform.openFileDialog()
      if (!opened) return null
      return addOpenedDocument(opened)
    } catch (error) {
      ui.toast('error', t('toasts.openFailed'), describeError(error))
      return null
    }
  }

  async function openAbsolutePaths(paths: string[]): Promise<void> {
    for (const path of paths) {
      if (!isOpenableTextFile(path)) continue
      await openRef(platform.documentRefForPath(path))
    }
  }

  async function openDroppedFiles(files: File[]): Promise<void> {
    for (const file of files) {
      if (!isOpenableTextFile(file.name)) continue
      try {
        const opened = await platform.openDroppedFile(file)
        if (opened) addOpenedDocument(opened)
      } catch (error) {
        ui.toast('error', t('toasts.openFailed'), describeError(error))
      }
    }
  }

  async function openRecent(entry: RecentDocument): Promise<EditorTab | null> {
    if (entry.origin === 'workspace') {
      if (!entry.path) return null
      const workspace = useWorkspaceStore()
      const current = workspace.info
      if (!current || current.id !== entry.workspaceId) {
        const stored = entry.workspace ?? {
          id: entry.workspaceId ?? entry.key,
          name: entry.workspaceId ?? '',
          rootPath: null,
        }
        const restored = await workspace.restore(stored)
        if (!restored) {
          ui.toast('warning', t('toasts.folderPermissionDenied'))
          return null
        }
      }
      return openWorkspaceFile(entry.path)
    }
    return openRef({
      key: entry.key,
      name: entry.name,
      path: entry.path,
      origin: 'file',
    })
  }

  function updateContent(tabKey: string, content: string): void {
    const tab = findTab(tabKey)
    if (!tab || tab.loading || tab.content === content) return
    tab.content = content
    scheduleAutosave(tab)
  }

  function setViewMode(tabKey: string, mode: TabViewMode): void {
    const tab = findTab(tabKey)
    if (!tab) return
    tab.viewMode = mode
    window.requestAnimationFrame(() => {
      if (mode === 'rich') focusEditor(tab.key)
    })
  }

  function toggleViewMode(tabKey?: string): void {
    const tab = findTab(tabKey ?? activeKey.value)
    if (!tab) return
    setViewMode(tab.key, tab.viewMode === 'rich' ? 'source' : 'rich')
  }

  function setOutline(tabKey: string, outline: OutlineItem[]): void {
    const tab = findTab(tabKey)
    if (tab) tab.outline = outline
  }

  function scheduleAutosave(tab: EditorTab): void {
    clearAutosave(tab.key)
    if (!settings.settings.autosave) return
    if (tab.ref.origin === 'untitled') return
    if (tab.conflict || tab.missing || tab.downloadOnly || tab.saving) return
    const timer = window.setTimeout(() => {
      autosaveTimers.delete(tab.key)
      if (!isDirty(tab) || tab.saving || tab.conflict || tab.missing) return
      void saveTab(tab)
    }, settings.settings.autosaveDelay)
    autosaveTimers.set(tab.key, timer)
  }

  function clearAutosave(tabKey: string): void {
    const timer = autosaveTimers.get(tabKey)
    if (timer) window.clearTimeout(timer)
    autosaveTimers.delete(tabKey)
  }

  function watchDocumentTab(tab: EditorTab): void {
    unwatchDocumentTab(tab.key)
    if (!platform.capabilities.fileSystemWatching) return
    if (tab.ref.origin !== 'file' || !tab.ref.path) return
    const path = normalizeSlashes(tab.ref.path)
    const stop = platform.watchDocument(tab.ref.path, () => {
      const target = tabs.value.find((item) => item.key === tab.key)
      if (!target || target.ref.origin !== 'file' || !target.ref.path) return
      if (normalizeSlashes(target.ref.path) !== path) return
      void checkDisk(target)
    })
    documentWatchers.set(tab.key, stop)
  }

  function unwatchDocumentTab(tabKey: string): void {
    const stop = documentWatchers.get(tabKey)
    if (!stop) return
    documentWatchers.delete(tabKey)
    stop()
  }

  async function hasExternalEdit(tab: EditorTab): Promise<boolean> {
    if (!platform.capabilities.fileSystemWatching) return false
    if (tab.ref.origin !== 'file' || !tab.ref.path || tab.downloadOnly) return false
    if (tab.mtime === null) return false
    try {
      const stat = await platform.statDocument(tab.ref)
      if (!stat.exists || stat.mtime === null || stat.mtime <= tab.mtime) return false
      const opened = await platform.readDocument(tab.ref)
      if (opened.content === tab.savedContent || opened.content === tab.content) {
        tab.mtime = opened.mtime
        return false
      }
      if (!isDirty(tab)) {
        tab.content = opened.content
        tab.savedContent = opened.content
        tab.mtime = opened.mtime
        tab.missing = false
        tab.reloadToken += 1
        if (tab.key === activeKey.value) {
          ui.toast('info', t('toasts.externalChangeReloaded'), tab.name)
        }
        return true
      }
      tab.conflict = true
      tab.pendingDiskContent = opened.content
      tab.mtime = opened.mtime
      tab.missing = false
      clearAutosave(tab.key)
      if (tab.key === activeKey.value) {
        ui.toast('warning', t('dialogs.conflictTitle'), tab.name)
      }
      return true
    } catch {
      return false
    }
  }

  async function saveTab(target: string | EditorTab): Promise<boolean> {
    const tab = typeof target === 'string' ? findTab(target) : target
    if (!tab) return false
    clearAutosave(tab.key)
    if (tab.saving) return false
    flushEditor(tab.key)
    if (tab.ref.origin === 'untitled' || tab.missing) return saveAsTab(tab)

    const content = tab.content
    tab.saving = true
    try {
      if (await hasExternalEdit(tab)) return false
      const result = await platform.writeDocument(tab.ref, content)
      tab.savedContent = content
      tab.mtime = result.mtime
      tab.conflict = false
      tab.pendingDiskContent = null
      tab.missing = false
      if (result.mode === 'downloaded') {
        tab.downloadOnly = true
        ui.toast('info', t('web.savedDownload', { name: tab.name }))
      }
      void snapshot(tab, 'manual')
      return true
    } catch (error) {
      const code = errorCode(error)
      if (code === 'NOT_FOUND') tab.missing = true
      ui.toast('error', t('toasts.saveFailed'), describeError(error))
      return false
    } finally {
      tab.saving = false
      if (isDirty(tab) && !tab.conflict && !tab.missing) scheduleAutosave(tab)
    }
  }

  async function saveAsTab(target: string | EditorTab): Promise<boolean> {
    const tab = typeof target === 'string' ? findTab(target) : target
    if (!tab) return false
    clearAutosave(tab.key)
    if (tab.saving) return false
    flushEditor(tab.key)
    const content = tab.content
    tab.saving = true
    try {
      const suggested = ensureMarkdownExtension(
        tab.name,
        settings.settings.defaultFileExtension,
      )
      const saved = await platform.saveDocumentAs(tab.ref, content, suggested)
      if (!saved) return false
      const ref = canonicalDocumentRef(saved)
      tab.ref = ref
      tab.name = ref.name
      watchDocumentTab(tab)
      tab.savedContent = content
      tab.missing = false
      tab.conflict = false
      tab.pendingDiskContent = null
      tab.downloadOnly =
        ref.origin === 'file' &&
        platform.kind === 'web' &&
        !platform.capabilities.nativeDialogs
      try {
        const stat = await platform.statDocument(ref)
        tab.mtime = stat.mtime
      } catch {
        tab.mtime = null
      }
      recent.record(ref)
      if (ref.origin === 'workspace') void useWorkspaceStore().refresh()
      ui.toast('success', t('toasts.fileSavedAs', { name: ref.name }))
      void snapshot(tab, 'manual')
      return true
    } catch (error) {
      ui.toast('error', t('toasts.saveFailed'), describeError(error))
      return false
    } finally {
      tab.saving = false
      if (isDirty(tab) && !tab.downloadOnly) scheduleAutosave(tab)
    }
  }

  async function saveActive(): Promise<boolean> {
    const tab = activeTab.value
    if (!tab) return false
    const saved = await saveTab(tab)
    if (saved) ui.toast('success', t('toasts.fileSaved', { name: tab.name }))
    return saved
  }

  async function saveActiveAs(): Promise<boolean> {
    const tab = activeTab.value
    if (!tab) return false
    return saveAsTab(tab)
  }

  async function requestClose(tab: EditorTab): Promise<boolean> {
    clearAutosave(tab.key)
    flushEditor(tab.key)
    if (!isDirty(tab) && !tab.saving) return true
    const choice = await ui.askUnsaved(tab.name)
    if (choice === 'cancel') return false
    if (choice === 'save') return saveTab(tab)
    return true
  }

  function removeTab(tab: EditorTab): void {
    clearAutosave(tab.key)
    unwatchDocumentTab(tab.key)
    const index = tabs.value.findIndex((item) => item.key === tab.key)
    if (index === -1) return
    tabs.value.splice(index, 1)
    if (activeKey.value === tab.key) {
      const next = tabs.value[Math.min(index, tabs.value.length - 1)]
      activeKey.value = next?.key ?? null
    }
  }

  async function closeTab(key: string): Promise<boolean> {
    const tab = findTab(key)
    if (!tab) return false
    if (!(await requestClose(tab))) return false
    removeTab(tab)
    return true
  }

  async function closeOthers(key: string): Promise<void> {
    const keep = findTab(key)
    if (!keep) return
    for (const tab of [...tabs.value]) {
      if (tab.key === key) continue
      if (!(await requestClose(tab))) return
      removeTab(tab)
    }
    activate(key)
  }

  async function closeAll(): Promise<void> {
    for (const tab of [...tabs.value]) {
      if (!(await requestClose(tab))) return
      removeTab(tab)
    }
  }

  async function closeWorkspaceTabs(): Promise<boolean> {
    for (const tab of [...tabs.value]) {
      if (tab.ref.origin !== 'workspace') continue
      if (!(await requestClose(tab))) return false
      removeTab(tab)
    }
    return true
  }

  function markDeleted(path: string, isDirectory = false): void {
    const clean = normalizeSlashes(path)
    for (const tab of tabs.value) {
      if (tab.ref.origin !== 'workspace' || !tab.ref.path) continue
      const affected = isDirectory
        ? tab.ref.path === clean || tab.ref.path.startsWith(`${clean}/`)
        : tab.ref.path === clean
      if (!affected) continue
      tab.missing = true
      tab.conflict = false
      tab.pendingDiskContent = null
      clearAutosave(tab.key)
    }
  }

  function remapWorkspacePath(path: string, nextPath: string, isDirectory = false): void {
    const clean = normalizeSlashes(path)
    const next = normalizeSlashes(nextPath)
    for (const tab of tabs.value) {
      if (tab.ref.origin !== 'workspace' || !tab.ref.path) continue
      const affected = isDirectory
        ? tab.ref.path === clean || tab.ref.path.startsWith(`${clean}/`)
        : tab.ref.path === clean
      if (!affected) continue
      const relative = isDirectory
        ? joinRelative(tab.ref.path, clean, next)
        : next
      try {
        tab.ref = platform.workspaceDocumentRef(relative)
        tab.name = tab.ref.name
      } catch {
        tab.missing = true
      }
    }
  }

  async function handleWorkspaceEvents(
    events: Array<{ type: string; path: string; isDirectory: boolean }>,
  ): Promise<void> {
    for (const event of events) {
      const path = normalizeSlashes(event.path)
      if (event.isDirectory) {
        if (event.type === 'unlinkDir') markDeleted(path, true)
        continue
      }
      const affected = tabs.value.filter(
        (tab) => tab.ref.origin === 'workspace' && tab.ref.path === path,
      )
      if (!affected.length) continue
      if (event.type === 'unlink') {
        markDeleted(path, false)
        continue
      }
      if (event.type === 'change' || event.type === 'add') {
        for (const tab of affected) await checkDisk(tab)
      }
    }
  }

  async function checkDisk(tab: EditorTab): Promise<void> {
    try {
      const opened = await platform.readDocument(tab.ref)
      const disk = opened.content
      if (disk === tab.content) {
        tab.savedContent = disk
        tab.mtime = opened.mtime
        tab.missing = false
        tab.conflict = false
        tab.pendingDiskContent = null
        return
      }
      if (!isDirty(tab)) {
        tab.content = disk
        tab.savedContent = disk
        tab.mtime = opened.mtime
        tab.missing = false
        tab.conflict = false
        tab.pendingDiskContent = null
        tab.reloadToken += 1
        if (tab.key === activeKey.value) {
          ui.toast('info', t('toasts.externalChangeReloaded'), tab.name)
        }
        return
      }
      if (disk === tab.savedContent) {
        tab.mtime = opened.mtime
        return
      }
      tab.conflict = true
      tab.pendingDiskContent = disk
      tab.mtime = opened.mtime
      tab.missing = false
      clearAutosave(tab.key)
      if (tab.key === activeKey.value) {
        ui.toast('warning', t('dialogs.conflictTitle'), tab.name)
      }
    } catch (error) {
      if (errorCode(error) === 'NOT_FOUND') {
        tab.missing = true
        tab.conflict = false
        tab.pendingDiskContent = null
        clearAutosave(tab.key)
      }
    }
  }

  function resolveConflict(key: string, choice: 'disk' | 'mine'): void {
    const tab = findTab(key)
    if (!tab || !tab.conflict) return
    const disk = tab.pendingDiskContent ?? tab.savedContent
    tab.conflict = false
    tab.pendingDiskContent = null
    if (choice === 'disk') {
      tab.content = disk
      tab.savedContent = disk
      tab.missing = false
      tab.reloadToken += 1
      return
    }
    tab.savedContent = disk
    ui.toast('info', t('toasts.externalChangeKept'), tab.name)
    void saveTab(tab)
  }

  function markSavedAs(tabKey: string): void {
    const tab = findTab(tabKey)
    if (tab) void saveAsTab(tab)
  }

  function historyOptions(): HistoryOptions {
    return {
      maxPerFile: settings.settings.historyMaxPerFile,
      retentionDays: settings.settings.historyRetentionDays,
    }
  }

  function canSnapshot(): boolean {
    return settings.settings.historyEnabled && platform.capabilities.localHistory
  }

  async function snapshot(tab: EditorTab, source: HistorySource): Promise<void> {
    if (!canSnapshot()) return
    if (snapshotting.has(tab.key)) return
    const content = tab.content
    if (!content.trim()) return
    if (source === 'auto' && content.length >= LARGE_DOCUMENT_THRESHOLD) return
    if (source !== 'manual' && content === tab.lastSnapshotContent) return
    snapshotting.add(tab.key)
    try {
      await platform.saveHistory(
        {
          documentKey: tab.ref.key,
          filePath: tab.ref.path ?? tab.name,
          fileName: tab.name,
          content,
          source,
        },
        historyOptions(),
      )
      tab.lastSnapshotAt = Date.now()
      tab.lastSnapshotContent = content
    } catch {
      // Version history is a background safety net; failing to store a copy is non-fatal.
    } finally {
      snapshotting.delete(tab.key)
    }
  }

  async function tickHistory(): Promise<void> {
    if (!canSnapshot()) return
    const interval = settings.settings.historyIntervalMinutes * 60 * 1000
    const now = Date.now()
    for (const tab of tabs.value) {
      if (!isDirty(tab) || tab.loading) continue
      if (now - tab.lastSnapshotAt < interval) continue
      if (tab.content === tab.lastSnapshotContent) continue
      await snapshot(tab, 'auto')
    }
  }

  async function restoreHistory(id: string): Promise<boolean> {
    try {
      const detail = await platform.readHistory(id)
      if (!detail) {
        ui.toast('error', t('toasts.historyRestoreFailed'))
        return false
      }
      const record = detail.record
      let tab =
        tabs.value.find((item) => sameDocumentKey(item.ref.key, record.documentKey)) ??
        null

      if (!tab) {
        const workspace = useWorkspaceStore()
        if (workspace.info && !isAbsolutePath(record.filePath)) {
          try {
            const ref = platform.workspaceDocumentRef(record.filePath)
            const opened = await platform.readDocument(ref)
            tab = addTab(opened.ref, opened.content, opened.mtime)
          } catch {
            tab = null
          }
        }
        if (!tab && platform.kind === 'desktop' && isAbsolutePath(record.filePath)) {
          const ref: DocumentRef = {
            key: `file:${record.filePath}`,
            name: record.fileName,
            path: record.filePath,
            origin: 'file',
          }
          tab = await openRef(ref, { silent: true })
        }
        if (!tab) {
          const ref: DocumentRef = {
            key: createId('untitled'),
            name: ensureMarkdownExtension(record.fileName || t('app.untitled')),
            path: null,
            origin: 'untitled',
          }
          tab = addTab(ref, detail.content, null)
        }
      }

      await snapshot(tab, 'restore')
      tab.content = detail.content
      tab.reloadToken += 1
      tab.viewMode = 'rich'
      activate(tab.key)
      ui.toast('success', t('toasts.historyRestored', { name: tab.name }))
      return true
    } catch (error) {
      ui.toast('error', t('toasts.historyRestoreFailed'), describeError(error))
      return false
    }
  }

  function sessionTabs(): SessionTab[] {
    return tabs.value
      .filter((tab) => tab.ref.origin !== 'untitled' && tab.ref.path)
      .map((tab) => ({
        key: tab.key,
        origin: tab.ref.origin,
        path: tab.ref.path,
        name: tab.name,
      }))
  }

  async function restoreSessionTabs(list: SessionTab[]): Promise<Map<string, string>> {
    const mapping = new Map<string, string>()
    for (const item of list) {
      if (!item.path) continue
      let ref: DocumentRef
      try {
        ref =
          item.origin === 'workspace'
            ? platform.workspaceDocumentRef(item.path)
            : { key: item.key, name: item.name, path: item.path, origin: 'file' }
      } catch {
        continue
      }
      const tab = await openRef(ref, { silent: true })
      if (tab) mapping.set(item.key, tab.key)
    }
    return mapping
  }

  function dispose(): void {
    for (const timer of autosaveTimers.values()) window.clearTimeout(timer)
    autosaveTimers.clear()
    for (const stop of documentWatchers.values()) stop()
    documentWatchers.clear()
  }

  return {
    tabs,
    activeKey,
    activeTab,
    activeDocumentKey,
    hasDirty,
    isDirty,
    findTab,
    findByRef,
    activate,
    createUntitled,
    addOpenedDocument,
    openRef,
    openWorkspaceFile,
    openFileDialog,
    openAbsolutePaths,
    openDroppedFiles,
    openRecent,
    updateContent,
    setViewMode,
    toggleViewMode,
    setOutline,
    saveTab,
    saveAsTab,
    saveActive,
    saveActiveAs,
    closeTab,
    closeOthers,
    closeAll,
    closeWorkspaceTabs,
    markDeleted,
    remapWorkspacePath,
    handleWorkspaceEvents,
    resolveConflict,
    markSavedAs,
    snapshot,
    tickHistory,
    restoreHistory,
    sessionTabs,
    restoreSessionTabs,
    dispose,
  }
})

function sameDocumentKey(a: string, b: string): boolean {
  if (a === b) return true
  if (!a.startsWith('file:') || !b.startsWith('file:')) return false
  return normalizeSlashes(a) === normalizeSlashes(b)
}

function canonicalDocumentRef(ref: DocumentRef): DocumentRef {
  if (ref.origin !== 'file' || !ref.path) return ref
  if (platform.kind !== 'desktop' || !isAbsolutePath(ref.path)) return ref
  return platform.documentRefForPath(ref.path)
}

function isAbsolutePath(path: string): boolean {
  return /^([a-zA-Z]:[\\/]|\/)/.test(path)
}

function joinRelative(path: string, oldBase: string, newBase: string): string {
  if (path === oldBase) return newBase
  return `${newBase}${path.slice(oldBase.length)}`
}
