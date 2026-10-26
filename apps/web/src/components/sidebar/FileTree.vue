<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronRight,
  File as FileIcon,
  FileCode,
  FileImage,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderX,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-vue-next'
import {
  basename,
  dirname,
  isImageFile,
  isOpenableTextFile,
  extensionOf,
  type FileEntry,
} from '@notadown/shared'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { useWorkspaceStore, type WorkspaceNode } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { useInjectedCommands } from '@/composables/use-app-commands'
import PopupMenu from '../common/PopupMenu.vue'
import type { MenuItem } from '../common/menu-types'

interface TreeRow {
  node: WorkspaceNode
  depth: number
}

interface TreeDialog {
  mode: 'file' | 'folder' | 'rename'
  parent: string
  path?: string
  kind?: 'file' | 'directory'
  name: string
}

const { t } = useI18n()
const workspace = useWorkspaceStore()
const tabs = useTabsStore()
const ui = useUiStore()
const settings = useSettingsStore()
const commands = useInjectedCommands()

const dialog = ref<TreeDialog | null>(null)
const dialogInput = ref<HTMLInputElement | null>(null)
const dialogError = ref('')
const busy = ref(false)

const contextOpen = ref(false)
const contextX = ref(0)
const contextY = ref(0)
const contextPath = ref<string | null>(null)
const contextKind = ref<'file' | 'directory' | null>(null)

const draggingPath = ref<string | null>(null)
const dropTarget = ref<string | null>(null)

const rows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = []
  const walk = (nodes: WorkspaceNode[], depth: number): void => {
    for (const node of nodes) {
      result.push({ node, depth })
      if (node.kind === 'directory' && workspace.expandedDirs.has(node.path)) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(workspace.tree, 0)
  return result
})

const contextItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  const isDirectory = contextKind.value === 'directory'
  const hasTarget = contextPath.value !== null
  if (!hasTarget || isDirectory) {
    items.push({ id: 'new-file', label: t('sidebar.newFile') })
    items.push({ id: 'new-folder', label: t('sidebar.newFolder') })
    items.push({ id: 'sep-1', separator: true })
  }
  if (hasTarget) {
    items.push({
      id: 'rename',
      label: t('sidebar.rename'),
      shortcut: commands.shortcut('workspace.renameEntry'),
    })
    items.push({ id: 'duplicate', label: t('sidebar.duplicate') })
    items.push({ id: 'delete', label: t('sidebar.delete'), danger: true })
    items.push({ id: 'sep-2', separator: true })
    if (platform.capabilities.revealInFolder) {
      items.push({ id: 'reveal', label: t('sidebar.reveal') })
    }
    items.push({ id: 'copy-path', label: t('tabs.copyPath') })
    items.push({ id: 'sep-3', separator: true })
  }
  items.push({ id: 'refresh', label: t('sidebar.refresh') })
  return items
})

watch(
  () => workspace.info?.id,
  () => {
    contextOpen.value = false
    dialog.value = null
  },
)

function defaultParent(): string {
  const selected = workspace.selectedPath
  if (selected) {
    const entry = findEntry(selected)
    return entry?.kind === 'directory' ? selected : dirname(selected)
  }
  const active = tabs.activeTab
  if (active?.ref.origin === 'workspace' && active.ref.path) return dirname(active.ref.path)
  return ''
}

function findEntry(path: string): FileEntry | undefined {
  return workspace.entries.find((entry) => entry.path === path)
}

function iconFor(node: WorkspaceNode) {
  if (node.kind === 'directory') return Folder
  if (isImageFile(node.name)) return FileImage
  const extension = extensionOf(node.name)
  if (['js', 'ts', 'tsx', 'jsx', 'vue', 'json', 'css', 'scss', 'html', 'py', 'rs', 'go', 'sh', 'yml', 'yaml', 'toml'].includes(extension)) {
    return FileCode
  }
  if (isOpenableTextFile(node.name)) return FileText
  return FileIcon
}

function isOpen(node: WorkspaceNode): boolean {
  return node.kind === 'directory' && workspace.expandedDirs.has(node.path)
}

function tabFor(node: WorkspaceNode) {
  return tabs.tabs.find(
    (tab) => tab.ref.origin === 'workspace' && tab.ref.path === node.path,
  )
}

function tabAlert(node: WorkspaceNode): 'conflict' | 'missing' | null {
  const tab = tabFor(node)
  if (!tab) return null
  if (tab.conflict) return 'conflict'
  if (tab.missing) return 'missing'
  return null
}

function isTabDirty(node: WorkspaceNode): boolean {
  const tab = tabFor(node)
  return tab ? tabs.isDirty(tab) : false
}

function handleRow(node: WorkspaceNode): void {
  workspace.select(node.path)
  if (node.kind === 'directory') {
    void workspace.toggleDir(node.path)
    return
  }
  if (isOpenableTextFile(node.name)) {
    void tabs.openWorkspaceFile(node.path)
    closeSidebarOnMobile()
  } else {
    ui.toast('warning', t('tree.unsupportedFile'), node.name)
  }
}

function closeSidebarOnMobile(): void {
  if (window.matchMedia('(max-width: 720px)').matches) ui.toggleSidebar(false)
}

function onRowMenu(event: MouseEvent, node: WorkspaceNode): void {
  workspace.select(node.path)
  contextPath.value = node.path
  contextKind.value = node.kind
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  contextX.value = rect.right - 190
  contextY.value = rect.bottom + 4
  contextOpen.value = true
}

function openDialog(mode: TreeDialog['mode'], parent: string, path?: string, kind?: 'file' | 'directory', name = ''): void {
  dialog.value = { mode, parent, path, kind, name }
  dialogError.value = ''
  void nextTick(() => {
    dialogInput.value?.focus()
    dialogInput.value?.select()
  })
}

function startCreate(mode: 'file' | 'folder'): void {
  openDialog(mode, defaultParent())
}

function startRename(path: string, kind: 'file' | 'directory', name = basename(path)): void {
  workspace.select(path)
  openDialog('rename', dirname(path), path, kind, name)
}

function onRowKeydown(event: KeyboardEvent, node: WorkspaceNode): void {
  if ((event.target as HTMLElement).closest('button') !== null) return
  if (event.key === 'F2' || (commands.platform === 'mac' && event.key === 'Enter')) {
    event.preventDefault()
    startRename(node.path, node.kind, node.name)
    return
  }
  if (event.key === 'Enter') handleRow(node)
}

async function submitDialog(): Promise<void> {
  const current = dialog.value
  if (!current || busy.value) return
  const value = current.name.trim()
  if (!value || /[\\/]/.test(value) || value === '.' || value === '..') {
    dialogError.value = t('tree.invalidName')
    return
  }
  busy.value = true
  dialogError.value = ''
  try {
    if (current.mode === 'rename' && current.path) {
      const target = current.path
      const nextPath = await workspace.renameEntry(target, value)
      if (nextPath && nextPath !== target) {
        tabs.remapWorkspacePath(target, nextPath, current.kind === 'directory')
        ui.toast('success', t('tree.renamed', { name: basename(nextPath) }))
      }
      dialog.value = null
    } else if (current.mode === 'folder') {
      const path = await workspace.createDirectory(current.parent, value)
      if (path) ui.toast('success', t('tree.created', { name: basename(path) }))
      dialog.value = null
    } else {
      const path = await workspace.createFile(current.parent, value)
      dialog.value = null
      if (path) {
        ui.toast('success', t('tree.created', { name: basename(path) }))
        await tabs.openWorkspaceFile(path)
      }
    }
  } catch (error) {
    dialogError.value = describeError(error)
  } finally {
    busy.value = false
  }
}

function onRowContext(event: MouseEvent, node: WorkspaceNode): void {
  event.preventDefault()
  workspace.select(node.path)
  contextPath.value = node.path
  contextKind.value = node.kind
  contextX.value = event.clientX
  contextY.value = event.clientY
  contextOpen.value = true
}

function onRootContext(event: MouseEvent): void {
  if ((event.target as HTMLElement).closest('.tree-row')) return
  event.preventDefault()
  contextPath.value = null
  contextKind.value = null
  contextX.value = event.clientX
  contextY.value = event.clientY
  contextOpen.value = true
}

function handleContextSelect(id: string): void {
  const target = contextPath.value
  const parent = target
    ? contextKind.value === 'directory'
      ? target
      : dirname(target)
    : ''
  switch (id) {
    case 'new-file':
      openDialog('file', parent)
      break
    case 'new-folder':
      openDialog('folder', parent)
      break
    case 'rename':
      if (target) startRename(target, contextKind.value ?? 'file')
      break
    case 'duplicate':
      if (target) void duplicateEntry(target)
      break
    case 'delete':
      if (target) void removeEntry(target, contextKind.value ?? 'file')
      break
    case 'reveal':
      if (target) void revealEntry(target)
      break
    case 'copy-path':
      if (target) void copyPath(target)
      break
    case 'refresh':
      void workspace.refresh()
      break
  }
}

async function removeEntry(path: string, kind: 'file' | 'directory'): Promise<void> {
  if (settings.settings.confirmDelete) {
    const message =
      kind === 'directory'
        ? t('tree.confirmDeleteFolder')
        : platform.capabilities.revealInFolder
          ? t('tree.confirmDeleteFile')
          : t('tree.confirmDeletePermanent')
    const confirmed = await ui.confirm({
      title: t('tree.confirmDeleteTitle', { name: basename(path) }),
      message,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
    })
    if (!confirmed) return
  }
  try {
    await workspace.deleteEntry(path)
    tabs.markDeleted(path, kind === 'directory')
    ui.toast('success', t('tree.deleted', { name: basename(path) }))
  } catch (error) {
    ui.toast('error', t('errors.generic'), describeError(error))
  }
}

async function revealEntry(path: string): Promise<void> {
  try {
    await workspace.revealEntry(path)
  } catch {
    ui.toast('warning', t('tree.revealUnavailable'))
  }
}

async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path)
    ui.toast('success', t('common.copied'))
  } catch {
    ui.toast('error', t('toasts.copyFailed'))
  }
}

async function duplicateEntry(path: string): Promise<void> {
  try {
    const nextPath = await workspace.duplicateEntry(path, t('tree.duplicateSuffix'))
    if (nextPath) ui.toast('success', t('tree.duplicated', { name: basename(nextPath) }))
  } catch (error) {
    ui.toast('error', t('tree.duplicateFailed'), describeError(error))
  }
}

function canDropInto(directory: string, source: string): boolean {
  if (directory === source) return false
  if (dirname(source) === directory) return false
  const entry = findEntry(source)
  if (entry?.kind === 'directory' && directory.startsWith(`${source}/`)) return false
  return true
}

function onDragStart(event: DragEvent, node: WorkspaceNode): void {
  draggingPath.value = node.path
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', node.path)
  }
}

function onDragEnd(): void {
  draggingPath.value = null
  dropTarget.value = null
}

function onDragOver(event: DragEvent, directory: string): void {
  const source = draggingPath.value
  if (!source || !canDropInto(directory, source)) return
  if (directory === '' && (event.target as HTMLElement).closest('.tree-row')) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropTarget.value = directory
}

function onDragLeave(event: DragEvent, directory: string): void {
  const next = event.relatedTarget
  if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return
  if (dropTarget.value === directory) dropTarget.value = null
}

function onDrop(event: DragEvent, directory: string): void {
  const source = draggingPath.value
  draggingPath.value = null
  dropTarget.value = null
  if (!source) return
  if (directory === '' && (event.target as HTMLElement).closest('.tree-row')) return
  event.preventDefault()
  event.stopPropagation()
  if (!canDropInto(directory, source)) return
  void moveEntry(source, directory)
}

async function moveEntry(source: string, directory: string): Promise<void> {
  const isDirectory = findEntry(source)?.kind === 'directory'
  try {
    const nextPath = await workspace.moveEntry(source, directory)
    if (nextPath) {
      tabs.remapWorkspacePath(source, nextPath, isDirectory)
      ui.toast('success', t('tree.moved', { name: basename(nextPath) }))
    }
  } catch (error) {
    ui.toast('error', t('tree.moveFailed'), describeError(error))
  }
}

function openWorkspace(): void {
  void commands.run('file.openWorkspace')
}

function closeWorkspace(): void {
  void commands.run('file.closeWorkspace')
}

function closeDialog(): void {
  if (busy.value) return
  dialog.value = null
}
</script>

<template>
  <div class="file-tree">
    <div class="tree-toolbar">
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('sidebar.newFile')"
        :disabled="!workspace.isOpen"
        @click="startCreate('file')"
      >
        <FilePlus :size="15" />
      </button>
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('sidebar.newFolder')"
        :disabled="!workspace.isOpen"
        @click="startCreate('folder')"
      >
        <FolderPlus :size="15" />
      </button>
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('sidebar.refresh')"
        :disabled="!workspace.isOpen"
        @click="workspace.refresh()"
      >
        <RefreshCw :size="14" />
      </button>
      <span class="tree-toolbar__spacer" />
      <button
        v-if="workspace.info"
        type="button"
        class="tree-toolbar__workspace"
        :title="workspace.info.name"
        @click="workspace.isOpen && workspace.select(null)"
      >
        {{ workspace.info.name }}
      </button>
      <button
        v-if="workspace.isOpen"
        type="button"
        class="nd-icon-btn"
        :title="t('menu.closeFolder')"
        @click="closeWorkspace"
      >
        <FolderX :size="14" />
      </button>
    </div>

    <div
      v-if="!workspace.isOpen"
      class="nd-empty tree-empty"
    >
      <FolderOpen :size="26" :stroke-width="1.5" />
      <div class="nd-empty-title">{{ t('sidebar.noWorkspace') }}</div>
      <p class="nd-empty-text">{{ t('sidebar.noWorkspaceHint') }}</p>
      <button
        v-if="platform.capabilities.folderWorkspace"
        type="button"
        class="nd-btn nd-btn--sm"
        @click="openWorkspace"
      >
        {{ t('sidebar.openFolder') }}
      </button>
      <p v-else class="nd-empty-text">{{ t('web.folderUnavailable') }}</p>
    </div>

    <div
      v-else
      class="file-tree__scroll nd-scroll"
      :class="{ 'is-drop-root': dropTarget === '' }"
      @contextmenu="onRootContext"
      @dragover="onDragOver($event, '')"
      @dragleave="onDragLeave($event, '')"
      @drop="onDrop($event, '')"
    >
      <div v-if="rows.length === 0" class="nd-empty">
        <p class="nd-empty-text">{{ t('sidebar.emptyFolder') }}</p>
        <button type="button" class="nd-btn nd-btn--sm" @click="startCreate('file')">
          {{ t('sidebar.newFile') }}
        </button>
      </div>

      <div
        v-for="row in rows"
        :key="row.node.path"
        class="tree-row"
        :class="{
          'is-selected': workspace.selectedPath === row.node.path,
          'is-directory': row.node.kind === 'directory',
          'is-drop-target': dropTarget === row.node.path && row.node.kind === 'directory',
          'is-dragging': draggingPath === row.node.path,
        }"
        :style="{ paddingLeft: `${6 + row.depth * 14}px` }"
        :title="row.node.path"
        role="treeitem"
        tabindex="0"
        :aria-expanded="row.node.kind === 'directory' ? isOpen(row.node) : undefined"
        draggable="true"
        @click="handleRow(row.node)"
        @keydown="onRowKeydown($event, row.node)"
        @contextmenu.stop="onRowContext($event, row.node)"
        @dragstart="onDragStart($event, row.node)"
        @dragend="onDragEnd"
        @dragover="row.node.kind === 'directory' ? onDragOver($event, row.node.path) : undefined"
        @dragleave="row.node.kind === 'directory' ? onDragLeave($event, row.node.path) : undefined"
        @drop="row.node.kind === 'directory' ? onDrop($event, row.node.path) : undefined"
      >
        <span v-if="row.node.kind === 'directory'" class="tree-row__chevron" :class="{ 'is-open': isOpen(row.node) }">
          <ChevronRight :size="13" />
        </span>
        <span v-else class="tree-row__chevron tree-row__chevron--placeholder" />
        <component
          :is="iconFor(row.node)"
          :size="14"
          :stroke-width="1.6"
          class="tree-row__icon"
        />
        <span class="tree-row__name">{{ row.node.name }}</span>
        <span
          v-if="tabAlert(row.node)"
          class="tree-row__dot is-warning"
          :title="tabAlert(row.node) === 'conflict' ? t('tabs.conflict') : t('tabs.missing')"
        />
        <span
          v-else-if="isTabDirty(row.node)"
          class="tree-row__dot"
          :title="t('tabs.unsaved')"
        />
        <button
          type="button"
          class="tree-row__more"
          :title="t('menu.showMenu')"
          :aria-label="t('menu.showMenu')"
          @click.stop="onRowMenu($event, row.node)"
        >
          <MoreHorizontal :size="14" />
        </button>
      </div>
    </div>

    <PopupMenu
      :open="contextOpen"
      :x="contextX"
      :y="contextY"
      :items="contextItems"
      @close="contextOpen = false"
      @select="handleContextSelect"
    />

    <Teleport to="body">
      <div v-if="dialog" class="nd-overlay nd-overlay--center" @mousedown.self="closeDialog">
        <div class="nd-dialog tree-dialog" @keydown.esc.stop="closeDialog">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">
              {{
                dialog.mode === 'rename'
                  ? t('sidebar.rename')
                  : dialog.mode === 'folder'
                    ? t('sidebar.newFolder')
                    : t('sidebar.newFile')
              }}
            </h2>
          </header>
          <div class="nd-dialog-body">
            <label class="nd-field">
              <span class="nd-field-label">
                {{
                  dialog.mode === 'rename'
                    ? t('tree.renamePlaceholder')
                    : dialog.mode === 'folder'
                      ? t('tree.newFolderPlaceholder')
                      : t('tree.newFilePlaceholder')
                }}
              </span>
              <input
                ref="dialogInput"
                v-model="dialog.name"
                class="nd-input"
                :placeholder="
                  dialog.mode === 'rename'
                    ? t('tree.renamePlaceholder')
                    : dialog.mode === 'folder'
                      ? t('tree.newFolderPlaceholder')
                      : t('tree.newFilePlaceholder')
                "
                spellcheck="false"
                @keydown.enter.prevent="submitDialog"
              >
            </label>
            <p v-if="dialogError" class="tree-dialog__error">{{ dialogError }}</p>
          </div>
          <footer class="nd-dialog-footer">
            <button type="button" class="nd-btn" :disabled="busy" @click="closeDialog">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="nd-btn nd-btn--primary" :disabled="busy" @click="submitDialog">
              {{ dialog.mode === 'rename' ? t('sidebar.rename') : t('common.create') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.file-tree {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--nd-border) 70%, transparent);
}

.tree-toolbar__spacer {
  flex: 1;
}

.tree-toolbar__workspace {
  overflow: hidden;
  max-width: 120px;
  padding: 0 4px;
  border: none;
  background: transparent;
  color: var(--nd-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-toolbar__workspace:hover {
  color: var(--nd-text);
}

.tree-empty {
  flex: 1;
}

.file-tree__scroll {
  flex: 1;
  padding: 4px 4px 20px;
  overflow-x: hidden;
  overflow-y: auto;
}

.file-tree__scroll.is-drop-root {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--nd-accent) 35%, transparent);
  border-radius: var(--nd-radius-md);
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 27px;
  padding-right: 8px;
  border-radius: var(--nd-radius-sm);
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  cursor: default;
  user-select: none;
}

.tree-row:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.tree-row.is-selected {
  background: color-mix(in srgb, var(--nd-accent) 12%, transparent);
  color: var(--nd-text);
}

.tree-row.is-drop-target {
  background: color-mix(in srgb, var(--nd-accent) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nd-accent) 45%, transparent);
}

.tree-row.is-dragging {
  opacity: 0.55;
}

.tree-row__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 14px;
  height: 14px;
  color: var(--nd-text-muted);
  transition: transform 0.14s ease;
}

.tree-row__chevron.is-open {
  transform: rotate(90deg);
}

.tree-row__chevron--placeholder {
  visibility: hidden;
}

.tree-row__icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.tree-row.is-directory .tree-row__icon {
  color: color-mix(in srgb, var(--nd-accent) 65%, var(--nd-text-muted));
}

.tree-row__name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-row__dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nd-accent);
}

.tree-row__dot.is-warning {
  background: var(--nd-warning);
}

.tree-dialog {
  width: min(400px, 100%);
}

.tree-dialog__error {
  margin: 8px 0 0;
  color: var(--nd-danger);
  font-size: 12px;
}

.tree-row__more {
  display: none;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nd-text-muted);
}

.tree-row__more:hover {
  background: var(--nd-surface-hover);
  color: var(--nd-text);
}

@media (max-width: 720px), (hover: none) {
  .tree-row {
    height: 34px;
  }

  .tree-row__more {
    display: inline-flex;
  }

  .tree-row__name {
    font-size: 13px;
  }
}
</style>
