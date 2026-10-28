<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Files, History, Keyboard, ListTree, Search, Settings } from 'lucide-vue-next'
import type { SidebarView } from '@notadown/shared'
import { useUiStore } from '@/stores/ui'
import { useTabsStore } from '@/stores/tabs'

const VIEWS: Array<{ id: SidebarView; icon: typeof Files; label: string }> = [
  { id: 'files', icon: Files, label: 'sidebar.files' },
  { id: 'search', icon: Search, label: 'sidebar.search' },
  { id: 'outline', icon: ListTree, label: 'sidebar.outline' },
  { id: 'history', icon: History, label: 'sidebar.history' },
]

const { t } = useI18n()
const ui = useUiStore()
const tabs = useTabsStore()

const fileAlert = computed(() =>
  tabs.tabs.some((tab) => tab.conflict || tab.missing),
)

function select(view: SidebarView): void {
  if (ui.sidebarOpen && ui.sidebarView === view) {
    ui.toggleSidebar(false)
    return
  }
  ui.setSidebarView(view)
}

function openSettings(): void {
  ui.openSettings()
}

function openShortcuts(): void {
  ui.shortcutsOpen = true
}
</script>

<template>
  <nav class="activity-bar" :aria-label="t('menu.view')">
    <div class="activity-bar__group">
      <button
        v-for="view in VIEWS"
        :key="view.id"
        type="button"
        class="activity-bar__button"
        :class="{ 'is-active': ui.sidebarOpen && ui.sidebarView === view.id }"
        :title="t(view.label)"
        :aria-label="t(view.label)"
        @click="select(view.id)"
      >
        <component :is="view.icon" :size="19" :stroke-width="1.7" />
        <span v-if="view.id === 'files' && fileAlert" class="activity-bar__alert" />
      </button>
    </div>

    <div class="activity-bar__group activity-bar__group--bottom">
      <button
        type="button"
        class="activity-bar__button"
        :title="t('menu.settings')"
        :aria-label="t('menu.settings')"
        @click="openSettings"
      >
        <Settings :size="19" :stroke-width="1.7" />
      </button>
      <button
        type="button"
        class="activity-bar__button"
        :title="t('menu.keyboardShortcuts')"
        :aria-label="t('menu.keyboardShortcuts')"
        @click="openShortcuts"
      >
        <Keyboard :size="19" :stroke-width="1.7" />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.activity-bar {
  display: flex;
  flex: 0 0 var(--nd-rail-width);
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: var(--nd-rail-width);
  padding: 8px 0 10px;
  border-right: 1px solid var(--nd-border);
  background: var(--nd-bg-elevated);
}

.activity-bar__group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.activity-bar__button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--nd-activity-button-size);
  height: var(--nd-activity-button-size);
  border: none;
  border-radius: var(--nd-radius-md);
  background: transparent;
  color: var(--nd-text-muted);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.activity-bar__button:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.activity-bar__button.is-active {
  background: var(--nd-surface);
  color: var(--nd-accent);
}

.activity-bar__button.is-active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--nd-accent);
}

.activity-bar__alert {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nd-warning);
  box-shadow: 0 0 0 2px var(--nd-bg-elevated);
}

@media (max-width: 720px) {
  .activity-bar {
    display: none;
  }
}
</style>
