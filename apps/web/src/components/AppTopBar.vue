<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FolderOpen,
  Menu,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sun,
} from 'lucide-vue-next'
import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { useInjectedCommands } from '@/composables/use-app-commands'
import BrandMark from './common/BrandMark.vue'
import PopupMenu from './common/PopupMenu.vue'
import type { MenuItem } from './common/menu-types'

const { t } = useI18n()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const commands = useInjectedCommands()

const isDesktop = platform.kind === 'desktop'
const isMac = isDesktop && window.notadown?.platform === 'darwin'

const menuOpen = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  const add = (...ids: string[]) => {
    for (const id of ids) {
      const command = commands.get(id)
      if (!command) continue
      items.push({
        id,
        label: command.title,
        shortcut: command.shortcut ? commands.shortcut(command.shortcut) : undefined,
      })
    }
  }
  const separator = () => items.push({ id: `sep-${items.length}`, separator: true })

  add('file.new', 'file.open', 'file.openWorkspace', 'file.save', 'file.saveAs', 'file.closeTab')
  separator()
  add('edit.find')
  separator()
  add('view.toggleSidebar', 'view.files', 'view.search', 'view.outline', 'view.history')
  separator()
  add('view.sourceMode', 'view.focusMode', 'view.typewriterMode', 'view.colorMode')
  separator()
  add('settings.open', 'help.shortcuts', 'help.about')
  return items
})

function toggleMenu(event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  menuX.value = rect.right - 236
  menuY.value = rect.bottom + 6
  menuOpen.value = !menuOpen.value
}

function handleMenuSelect(id: string): void {
  void commands.run(id)
}

function openWorkspace(): void {
  void commands.run('file.openWorkspace')
}
</script>

<template>
  <header class="topbar" :class="{ 'is-desktop': isDesktop, 'is-mac': isMac }">
    <button
      type="button"
      class="nd-icon-btn topbar__sidebar-toggle"
      :title="t('menu.toggleSidebar')"
      @click="ui.toggleSidebar()"
    >
      <PanelLeft :size="17" />
    </button>

    <div class="topbar__brand">
      <BrandMark :size="22" />
      <span class="topbar__name">NotaDown</span>
    </div>

    <button
      type="button"
      class="workspace-chip"
      :title="t('menu.openFolder')"
      @click="openWorkspace"
    >
      <FolderOpen :size="14" />
      <span class="workspace-chip__label">
        {{ workspace.info?.name ?? t('menu.openFolder') }}
      </span>
    </button>

    <div class="topbar__actions">
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('menu.search')"
        @click="ui.focusSearch()"
      >
        <Search :size="16" />
      </button>
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('menu.toggleColorMode')"
        @click="commands.run('view.colorMode')"
      >
        <Sun v-if="settings.effectiveMode === 'dark'" :size="16" />
        <Moon v-else :size="16" />
      </button>
      <button
        type="button"
        class="nd-icon-btn topbar__settings"
        :title="t('menu.settings')"
        @click="ui.openSettings()"
      >
        <Settings :size="16" />
      </button>
      <button
        type="button"
        class="nd-icon-btn topbar__menu"
        :title="t('menu.showMenu')"
        @click="toggleMenu"
      >
        <Menu :size="17" />
      </button>
    </div>

    <PopupMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      :width="236"
      :items="menuItems"
      @close="menuOpen = false"
      @select="handleMenuSelect"
    />
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--nd-topbar-height);
  padding: 0 12px;
  border-bottom: 1px solid var(--nd-border);
  background: var(--nd-bg);
  flex: 0 0 auto;
}

.topbar.is-desktop {
  -webkit-app-region: drag;
}

.topbar.is-desktop button {
  -webkit-app-region: no-drag;
}

.topbar.is-mac {
  padding-left: 78px;
}

.topbar__sidebar-toggle {
  display: none;
  flex: 0 0 auto;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 4px;
}

.topbar__name {
  font-family: var(--nd-font-display);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--nd-text);
}

.workspace-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--nd-border);
  border-radius: 99px;
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 12px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.workspace-chip:hover {
  background: var(--nd-surface);
  border-color: var(--nd-border-strong);
  color: var(--nd-text);
}

.workspace-chip__label {
  overflow: hidden;
  max-width: 220px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

@media (max-width: 720px) {
  .topbar {
    gap: 6px;
    padding: 0 8px;
  }

  .topbar__sidebar-toggle {
    display: inline-flex;
  }

  .workspace-chip {
    height: 28px;
  }

  .workspace-chip__label {
    max-width: 120px;
  }
}

@media (max-width: 640px) {
  .topbar__name,
  .topbar__settings {
    display: none;
  }
}

@media (max-width: 480px) {
  .workspace-chip {
    padding: 0 8px;
  }

  .workspace-chip__label {
    display: none;
  }
}
</style>
