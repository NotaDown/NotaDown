<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PanelLeftClose } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import FileTree from './sidebar/FileTree.vue'
import SidebarSearch from './sidebar/SidebarSearch.vue'
import OutlinePanel from './sidebar/OutlinePanel.vue'
import HistoryPanel from './sidebar/HistoryPanel.vue'

const { t } = useI18n()
const ui = useUiStore()

const sidebarRef = ref<HTMLElement | null>(null)
const resizing = ref(false)
let startX = 0
let startWidth = 0

const title = computed(() => t(`sidebar.${ui.sidebarView}`))

function startResize(event: PointerEvent): void {
  if (event.button !== 0) return
  const element = sidebarRef.value
  if (!element) return
  resizing.value = true
  startX = event.clientX
  startWidth = element.getBoundingClientRect().width
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}

function handleResize(event: PointerEvent): void {
  if (!resizing.value) return
  const width = Math.min(480, Math.max(180, startWidth + event.clientX - startX))
  ui.sidebarWidth = width
}

function endResize(event: PointerEvent): void {
  if (!resizing.value) return
  resizing.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

function resetWidth(): void {
  ui.sidebarWidth = 260
}
</script>

<template>
  <aside
    ref="sidebarRef"
    class="app-sidebar"
    :class="{ 'is-resizing': resizing }"
    :style="{ width: `${ui.sidebarWidth}px` }"
  >
    <header class="app-sidebar__head">
      <span class="app-sidebar__title">{{ title }}</span>
      <button
        type="button"
        class="nd-icon-btn app-sidebar__close"
        :title="t('common.collapse')"
        @click="ui.toggleSidebar(false)"
      >
        <PanelLeftClose :size="15" />
      </button>
    </header>
    <div class="app-sidebar__body">
      <FileTree v-show="ui.sidebarView === 'files'" />
      <SidebarSearch v-show="ui.sidebarView === 'search'" />
      <OutlinePanel v-show="ui.sidebarView === 'outline'" />
      <HistoryPanel v-show="ui.sidebarView === 'history'" />
    </div>
    <div
      class="app-sidebar__resizer"
      role="separator"
      aria-orientation="vertical"
      @pointerdown="startResize"
      @pointermove="handleResize"
      @pointerup="endResize"
      @pointercancel="endResize"
      @dblclick="resetWidth"
    />
  </aside>
</template>

<style scoped>
.app-sidebar {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-width: 180px;
  max-width: 480px;
  border-right: 1px solid var(--nd-border);
  background: var(--nd-bg-elevated);
}

.app-sidebar.is-resizing {
  user-select: none;
  cursor: col-resize;
}

.app-sidebar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 6px 0 14px;
  flex: 0 0 auto;
}

.app-sidebar__title {
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--nd-text-muted);
}

.app-sidebar__close {
  width: 24px;
  height: 24px;
}

.app-sidebar__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.app-sidebar__resizer {
  position: absolute;
  z-index: 5;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}

.app-sidebar__resizer:hover,
.app-sidebar.is-resizing .app-sidebar__resizer {
  background: color-mix(in srgb, var(--nd-accent) 35%, transparent);
}
</style>
