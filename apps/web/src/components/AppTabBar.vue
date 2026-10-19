<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FolderOpen,
  Plus,
  TriangleAlert,
  X,
  FileWarning,
} from 'lucide-vue-next'
import { useTabsStore, type EditorTab } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { platform } from '@/platform'
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
  const items: MenuItem[] = [
    { id: 'close', label: t('tabs.close') },
    { id: 'close-others', label: t('tabs.closeOthers'), disabled: tabs.tabs.length < 2 },
    { id: 'close-all', label: t('tabs.closeAll') },
  ]
  if (path) {
    items.push({ id: 'sep-1', separator: true })
    if (tab?.ref.origin === 'workspace' && platform.capabilities.revealInFolder) {
      items.push({ id: 'reveal', label: t('tabs.reveal') })
    }
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

async function handleMenuSelect(id: string): Promise<void> {
  const tab = contextTab.value
  if (!tab) return
  if (id === 'close') {
    await tabs.closeTab(tab.key)
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
  if (id === 'copy-path' && tab.ref.path) {
    try {
      await navigator.clipboard.writeText(tab.ref.path)
      ui.toast('success', t('toasts.linkCopied'))
    } catch {
      ui.toast('error', t('toasts.copyFailed'))
    }
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
</script>

<template>
  <div class="tab-bar">
    <div class="tab-bar__list nd-scroll" @dblclick.self="newTab">
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
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  height: 36px;
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
  width: 26px;
  height: 26px;
}
</style>
