<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FolderOpen,
  Plus,
  TriangleAlert,
  X,
  FileWarning,
} from '@lucide/vue'
import { basename } from '@notadown/shared'
import { useTabsStore, type EditorTab } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { useInjectedCommands } from '@/composables/use-app-commands'
import PopupMenu from './common/PopupMenu.vue'
import type { MenuItem } from './common/menu-types'

const { t } = useI18n()
const tabs = useTabsStore()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const commands = useInjectedCommands()

const tabElements = new Map<string, HTMLElement>()

const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const contextKey = ref<string | null>(null)

const contextTab = computed(
  () => tabs.tabs.find((tab) => tab.key === contextKey.value) ?? null,
)

const contextItems = computed<MenuItem[]>(() => {
  const tab = contextTab.value
  const path = tab?.ref.path ?? null
  const inWorkspace = tab?.ref.origin === 'workspace'
  const index = tab ? tabs.tabs.findIndex((item) => item.key === tab.key) : -1
  const items: MenuItem[] = [
    { id: 'close', label: t('tabs.close') },
    { id: 'close-left', label: t('tabs.closeLeft'), disabled: index < 1 },
    {
      id: 'close-right',
      label: t('tabs.closeRight'),
      disabled: index === -1 || index === tabs.tabs.length - 1,
    },
    { id: 'close-others', label: t('tabs.closeOthers'), disabled: tabs.tabs.length < 2 },
    { id: 'close-all', label: t('tabs.closeAll') },
  ]
  if (inWorkspace) {
    items.push({ id: 'sep-1', separator: true })
    items.push({
      id: 'rename',
      label: t('sidebar.rename'),
      shortcut: commands.shortcut('workspace.renameEntry'),
    })
  }
  items.push({ id: inWorkspace ? 'sep-2' : 'sep-1', separator: true })
  if (path && inWorkspace && platform.capabilities.revealInFolder) {
    items.push({ id: 'reveal', label: t('tabs.reveal') })
  }
  items.push({ id: 'copy-name', label: t('tabs.copyName') })
  if (path && platform.kind === 'desktop') {
    items.push({ id: 'copy-path', label: t('tabs.copyPath') })
  }
  return items
})

function setTabElement(
  key: string,
  element: Element | ComponentPublicInstance | null,
): void {
  if (element instanceof HTMLElement) tabElements.set(key, element)
  else tabElements.delete(key)
}

function scrollActiveIntoView(): void {
  const key = tabs.activeKey
  if (!key) return
  void nextTick(() => {
    tabElements.get(key)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

watch(() => tabs.activeKey, scrollActiveIntoView, { immediate: true })

function closeTab(event: MouseEvent, tab: EditorTab): void {
  event.stopPropagation()
  void tabs.closeTab(tab.key)
}

function onAuxClick(event: MouseEvent, tab: EditorTab): void {
  if (event.button !== 1) return
  event.preventDefault()
  void tabs.closeTab(tab.key)
}

function openMenu(event: MouseEvent, tab: EditorTab): void {
  event.preventDefault()
  contextKey.value = tab.key
  menuX.value = event.clientX
  menuY.value = event.clientY
  menuOpen.value = true
}

function tabTooltip(tab: EditorTab): string {
  if (tab.conflict) return `${tab.name} — ${t('tabs.conflict')}`
  if (tab.missing) return `${tab.name} — ${t('tabs.missing')}`
  const location = tab.ref.path ? `\n${tab.ref.path}` : ''
  return `${tab.name}${tab.saving ? ` — ${t('tabs.saving')}` : ''}${location}`
}

function stateLabel(tab: EditorTab): string {
  if (tab.conflict) return t('tabs.conflict')
  if (tab.missing) return t('tabs.missing')
  if (tabs.isDirty(tab)) return t('tabs.unsaved')
  return t('tabs.saved')
}

function newTab(): void {
  void commands.run('file.new')
}

// The blank strip is covered by the spacer span, so `dblclick.self` never fires.
function onListDblClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element) || target.closest('.tab')) return
  newTab()
}

async function handleMenuSelect(id: string): Promise<void> {
  const tab = contextTab.value
  if (!tab) return
  if (id === 'close') {
    await tabs.closeTab(tab.key)
    return
  }
  if (id === 'close-left') {
    await tabs.closeLeft(tab.key)
    return
  }
  if (id === 'close-right') {
    await tabs.closeRight(tab.key)
    return
  }
  if (id === 'close-others') {
    await tabs.closeOthers(tab.key)
    return
  }
  if (id === 'close-all') {
    await tabs.closeAll()
    return
  }
  if (id === 'rename') {
    openRenameDialog(tab)
    return
  }
  if (id === 'copy-name') {
    await copyToClipboard(tab.name)
    return
  }
  if (id === 'copy-path' && tab.ref.path) {
    await copyToClipboard(tab.ref.path)
    return
  }
  if (id === 'reveal' && tab.ref.path) {
    try {
      await workspace.revealEntry(tab.ref.path)
    } catch {
      ui.toast('error', t('tree.revealUnavailable'))
    }
  }
}

async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    ui.toast('success', t('common.copied'))
  } catch {
    ui.toast('error', t('toasts.copyFailed'))
  }
}

const renameDialog = ref<{ path: string; name: string } | null>(null)
const renameInput = ref<HTMLInputElement | null>(null)
const renameError = ref('')
const renameBusy = ref(false)

function openRenameDialog(tab: EditorTab): void {
  const path = tab.ref.path
  if (tab.ref.origin !== 'workspace' || !path) return
  renameDialog.value = { path, name: basename(path) }
  renameError.value = ''
  void nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function closeRenameDialog(): void {
  if (renameBusy.value) return
  renameDialog.value = null
}

// F2 renames the document when the user is working in the editor; the tree
// keeps its own inline rename while the tree is the last place they touched.
function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'F2' || event.defaultPrevented || renameDialog.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  const fromMenu = menuOpen.value
  if (!fromMenu && ui.workArea !== 'editor') return
  if (target.closest('input, textarea, .nd-dialog, .nd-overlay')) return
  const tab = fromMenu ? contextTab.value : tabs.activeTab
  if (tab?.ref.origin !== 'workspace' || !tab.ref.path) return
  if (fromMenu) menuOpen.value = false
  event.preventDefault()
  openRenameDialog(tab)
}

onMounted(() => window.addEventListener('keydown', onWindowKeydown))

onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKeydown))

async function submitRename(): Promise<void> {
  const current = renameDialog.value
  if (!current || renameBusy.value) return
  const value = current.name.trim()
  if (!value || /[\\/]/.test(value) || value === '.' || value === '..') {
    renameError.value = t('tree.invalidName')
    return
  }
  renameBusy.value = true
  renameError.value = ''
  try {
    const target = current.path
    const nextPath = await workspace.renameEntry(target, value)
    if (!nextPath) {
      renameError.value = t('tree.invalidName')
      return
    }
    renameDialog.value = null
    if (nextPath !== target) {
      tabs.remapWorkspacePath(target, nextPath, false)
      ui.toast('success', t('tree.renamed', { name: basename(nextPath) }))
    }
  } catch (error) {
    renameError.value = describeError(error)
  } finally {
    renameBusy.value = false
  }
}
</script>

<template>
  <div class="tab-bar" @pointerdown="ui.setWorkArea('editor')">
    <div class="tab-bar__list nd-scroll" @dblclick="onListDblClick">
      <button
        v-for="tab in tabs.tabs"
        :key="tab.key"
        :ref="(element) => setTabElement(tab.key, element)"
        type="button"
        class="tab"
        :class="{
          'is-active': tab.key === tabs.activeKey,
          'is-conflict': tab.conflict,
          'is-missing': tab.missing,
        }"
        :title="tabTooltip(tab)"
        @click="tabs.activate(tab.key)"
        @auxclick="onAuxClick($event, tab)"
        @contextmenu="openMenu($event, tab)"
      >
        <span class="tab__state" :class="{ 'is-dirty': tabs.isDirty(tab) }">
          <FileWarning v-if="tab.missing" :size="12" class="tab__warning" />
          <TriangleAlert v-else-if="tab.conflict" :size="12" class="tab__warning" />
          <span v-else-if="tabs.isDirty(tab)" class="tab__dot" />
        </span>
        <span class="tab__name">{{ tab.name }}</span>
        <span
          class="tab__close"
          role="button"
          tabindex="-1"
          :aria-label="t('tabs.close')"
          :title="t('tabs.close')"
          @click.stop="closeTab($event, tab)"
        >
          <X :size="13" />
        </span>
        <span class="tab__sr">{{ stateLabel(tab) }}</span>
      </button>
      <span class="tab-bar__spacer" />
    </div>

    <div class="tab-bar__actions">
      <button
        type="button"
        class="nd-icon-btn tab-bar__add"
        :title="t('menu.newDocument')"
        @click="newTab"
      >
        <Plus :size="15" />
      </button>
      <button
        type="button"
        class="nd-icon-btn tab-bar__folder"
        :title="t('menu.openFolder')"
        @click="commands.run('file.openWorkspace')"
      >
        <FolderOpen :size="14" />
      </button>
    </div>

    <PopupMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      :width="210"
      :items="contextItems"
      @close="menuOpen = false"
      @select="handleMenuSelect"
    />

    <Teleport to="body">
      <div v-if="renameDialog" class="nd-overlay nd-overlay--center" @mousedown.self="closeRenameDialog">
        <div class="nd-dialog tab-rename-dialog" @keydown.esc.stop="closeRenameDialog">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ t('sidebar.rename') }}</h2>
          </header>
          <div class="nd-dialog-body">
            <label class="nd-field">
              <span class="nd-field-label">{{ t('tree.renamePlaceholder') }}</span>
              <input
                ref="renameInput"
                v-model="renameDialog.name"
                class="nd-input"
                :placeholder="t('tree.renamePlaceholder')"
                spellcheck="false"
                @keydown.enter.prevent="submitRename"
              >
            </label>
            <p v-if="renameError" class="tab-rename-dialog__error">{{ renameError }}</p>
          </div>
          <footer class="nd-dialog-footer">
            <button type="button" class="nd-btn" :disabled="renameBusy" @click="closeRenameDialog">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="nd-btn nd-btn--primary" :disabled="renameBusy" @click="submitRename">
              {{ t('sidebar.rename') }}
            </button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  height: var(--nd-tab-height);
  border-bottom: 1px solid var(--nd-border);
  background: var(--nd-bg-elevated);
}

.tab-bar__list {
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.tab-bar__list::-webkit-scrollbar {
  display: none;
}

.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 200px;
  min-width: 92px;
  max-width: 220px;
  height: 100%;
  padding: 0 8px 0 12px;
  border: none;
  border-right: 1px solid var(--nd-border);
  background: transparent;
  color: var(--nd-text-muted);
  font-size: 12px;
  text-align: left;
  transition: background 0.12s ease, color 0.12s ease;
}

.tab:hover {
  background: var(--nd-surface);
  color: var(--nd-text-secondary);
}

.tab.is-active {
  background: var(--nd-bg);
  color: var(--nd-text);
}

.tab.is-active::after {
  content: '';
  position: absolute;
  inset: auto 0 -1px 0;
  height: 2px;
  background: var(--nd-accent);
}

.tab.is-conflict .tab__name,
.tab.is-missing .tab__name {
  color: var(--nd-warning);
}

.tab__state {
  display: flex;
  flex: 0 0 12px;
  align-items: center;
  justify-content: center;
}

.tab__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nd-accent);
}

.tab__warning {
  color: var(--nd-warning);
}

.tab__name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  opacity: 0;
  transition: background 0.12s ease, opacity 0.12s ease;
}

.tab:hover .tab__close,
.tab.is-active .tab__close {
  opacity: 0.75;
}

.tab__close:hover {
  background: var(--nd-surface-hover);
  opacity: 1;
}

.tab__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.tab-bar__spacer {
  flex: 1;
  min-width: 12px;
}

.tab-bar__actions {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 5px;
  border-left: 1px solid var(--nd-border);
}

.tab-bar__add,
.tab-bar__folder {
  width: var(--nd-control-height-sm);
  height: var(--nd-control-height-sm);
}

.tab-rename-dialog {
  width: min(400px, 100%);
}

.tab-rename-dialog__error {
  margin: 8px 0 0;
  color: var(--nd-danger);
  font-size: 12px;
}

@media (max-width: 720px) {
  .tab {
    flex-basis: 150px;
    min-width: 84px;
    max-width: 170px;
    padding-left: 9px;
  }

  .tab__close {
    width: 22px;
    height: 22px;
    opacity: 0.6;
  }

  .tab-bar__folder {
    display: none;
  }
}
</style>
