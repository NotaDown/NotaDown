<script setup lang="ts">
import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ListTree } from '@lucide/vue'
import type { OutlineItem } from '@notadown/shared'
import { useTabsStore } from '@/stores/tabs'
import { getEditor } from '@/editor-registry'

const { t } = useI18n()
const tabs = useTabsStore()

function goTo(item: OutlineItem): void {
  const tab = tabs.activeTab
  if (!tab) return
  if (tab.viewMode === 'source') {
    tabs.setViewMode(tab.key, 'rich')
    void nextTick(() => getEditor(tab.key)?.goToPosition(item.pos))
    return
  }
  getEditor(tab.key)?.goToPosition(item.pos)
}

function indent(level: number): string {
  return `${10 + Math.max(0, level - 1) * 13}px`
}
</script>

<template>
  <div class="outline-panel">
    <div v-if="!tabs.activeTab" class="nd-empty">
      <ListTree :size="26" :stroke-width="1.5" />
      <div class="nd-empty-title">{{ t('sidebar.outlineEmpty') }}</div>
      <p class="nd-empty-text">{{ t('sidebar.outlineHint') }}</p>
    </div>
    <div v-else-if="tabs.activeTab.outline.length === 0" class="nd-empty">
      <ListTree :size="26" :stroke-width="1.5" />
      <div class="nd-empty-title">{{ t('sidebar.outlineEmpty') }}</div>
      <p class="nd-empty-text">{{ t('sidebar.outlineHint') }}</p>
    </div>
    <div v-else class="outline-panel__list nd-scroll">
      <button
        v-for="(item, index) in tabs.activeTab.outline"
        :key="`${item.pos}-${index}`"
        type="button"
        class="outline-item"
        :class="`is-level-${item.level}`"
        :style="{ paddingLeft: indent(item.level) }"
        :title="item.text"
        @click="goTo(item)"
      >
        <span class="outline-item__text">{{ item.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.outline-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.outline-panel__list {
  flex: 1;
  padding: 6px 6px 20px;
  overflow-y: auto;
}

.outline-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--nd-tree-row-height);
  padding: 4px 8px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
}

.outline-item:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.outline-item.is-level-1 {
  color: var(--nd-text);
  font-size: 12.5px;
  font-weight: 600;
}

.outline-item.is-level-2 {
  font-weight: 550;
}

.outline-item__text {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
