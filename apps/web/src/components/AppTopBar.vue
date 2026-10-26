<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Download,
  FolderX,
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
import { usePwaInstall } from '@/composables/use-pwa-install'
import { appliedTitleBarMode, desktopPlatform } from '@/window-chrome'
import BrandMark from './common/BrandMark.vue'
import PopupMenu from './common/PopupMenu.vue'
import type { MenuItem } from './common/menu-types'

const { t } = useI18n()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const settings = useSettingsStore()
const commands = useInjectedCommands()
const { available: installAvailable, install } = usePwaInstall()

const isDesktop = platform.kind === 'desktop'
const integrated = computed(
  () => isDesktop && appliedTitleBarMode.value === 'integrated',
)
const integratedMac = computed(
  () => integrated.value && desktopPlatform.value === 'darwin',
)
const overlayControls = computed(
  () => integrated.value && desktopPlatform.value !== 'darwin',
)

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

  add('file.new', 'file.open', 'file.openWorkspace', 'file.closeWorkspace', 'file.save', 'file.saveAs', 'file.closeTab')
  separator()
  add('edit.find')
  separator()
  add('view.toggleSidebar', 'view.files', 'view.search', 'view.outline', 'view.history')
  separator()
  add('view.sourceMode', 'view.focusMode', 'view.typewriterMode', 'view.colorMode')
  separator()
  add('settings.open', 'help.shortcuts', 'help.checkUpdates', 'help.about')
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
</script>

<template>
  <header
    class="topbar"
    :class="{
      'is-desktop': isDesktop,
      'is-integrated': integrated,
      'is-mac': integratedMac,
      'has-overlay-controls': overlayControls,
    }"
  >
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

    <span
      v-if="workspace.info"
      class="workspace-name"
      :title="workspace.info.name"
    >{{ workspace.info.name }}</span>

    <div class="topbar__actions">
      <button
        v-if="workspace.isOpen"
        type="button"
        class="nd-icon-btn"
        :title="t('menu.closeFolder')"
        @click="commands.run('file.closeWorkspace')"
      >
        <FolderX :size="16" />
      </button>
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('menu.search')"
        @click="ui.focusSearch()"
      >
        <Search :size="16" />
      </button>
      <button
        v-if="installAvailable"
        type="button"
        class="nd-icon-btn"
        :title="t('web.installHint')"
        @click="install"
      >
        <Download :size="16" />
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

.topbar.is-desktop.is-integrated {
  -webkit-app-region: drag;
}

.topbar.is-desktop.is-integrated button,
.topbar.is-desktop.is-integrated input {
  -webkit-app-region: no-drag;
}

.topbar.is-mac {
  padding-left: 78px;
}

.topbar.has-overlay-controls {
  padding-right: 150px;
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

.workspace-name {
  min-width: 0;
  max-width: 220px;
  overflow: hidden;
  color: var(--nd-text-muted);
  font-size: 12px;
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

  .workspace-name {
    max-width: 140px;
  }
}

@media (max-width: 640px) {
  .topbar__name,
  .topbar__settings {
    display: none;
  }
}
</style>
