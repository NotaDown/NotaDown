<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronUp, Search, X } from '@lucide/vue'
import { useUiStore } from '@/stores/ui'
import { useTabsStore } from '@/stores/tabs'
import { getEditor } from '@/editor-registry'

const { t } = useI18n()
const ui = useUiStore()
const tabs = useTabsStore()

const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => ui.findOpen,
  async (open) => {
    if (!open) {
      getEditor(tabs.activeKey)?.clearFind()
      ui.findResult = null
      return
    }
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
    if (ui.findQuery) search(true)
  },
)

watch(
  () => ui.findQuery,
  () => {
    if (ui.findOpen) search(true)
  },
)

watch(
  () => tabs.activeKey,
  () => {
    if (ui.findOpen && ui.findQuery) search(true)
  },
)

function search(forward: boolean): void {
  const editor = getEditor(tabs.activeKey)
  if (!editor || !ui.findQuery.trim()) {
    ui.findResult = null
    return
  }
  ui.findResult = editor.find(ui.findQuery, forward)
  inputRef.value?.focus()
}

function next(): void {
  search(true)
}

function previous(): void {
  search(false)
}

function close(): void {
  getEditor(tabs.activeKey)?.clearFind()
  ui.closeFind()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (event.shiftKey) previous()
    else next()
  }
}
</script>

<template>
  <div v-if="ui.findOpen" class="find-bar" role="search">
    <Search :size="14" class="find-bar__icon" />
    <input
      ref="inputRef"
      v-model="ui.findQuery"
      type="text"
      class="find-bar__input"
      :placeholder="t('editor.find.find')"
      @keydown="onKeydown"
    />
    <span class="find-bar__count">
      {{ ui.findResult ? `${ui.findResult.index}/${ui.findResult.total}` : ui.findQuery.trim() ? '0/0' : '' }}
    </span>
    <button
      type="button"
      class="find-bar__button"
      :title="t('editor.find.previous')"
      @click="previous"
    >
      <ChevronUp :size="15" />
    </button>
    <button
      type="button"
      class="find-bar__button"
      :title="t('editor.find.next')"
      @click="next"
    >
      <ChevronDown :size="15" />
    </button>
    <button
      type="button"
      class="find-bar__button"
      :title="t('editor.find.close')"
      @click="close"
    >
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped>
.find-bar {
  position: absolute;
  z-index: 30;
  top: 10px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 2px;
  width: min(330px, calc(100% - 36px));
  height: 34px;
  padding: 0 5px 0 9px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg-elevated);
  box-shadow: var(--nd-shadow);
}

.find-bar__icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.find-bar__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: var(--nd-text);
  font-size: 12.5px;
  outline: none;
}

.find-bar__input::placeholder {
  color: var(--nd-text-muted);
}

.find-bar__count {
  flex: 0 0 auto;
  min-width: 34px;
  color: var(--nd-text-muted);
  font-size: 11px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.find-bar__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nd-text-secondary);
}

.find-bar__button:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

@media (max-width: 720px) {
  .find-bar {
    top: 6px;
    right: 6px;
    width: calc(100% - 12px);
  }
}
</style>
