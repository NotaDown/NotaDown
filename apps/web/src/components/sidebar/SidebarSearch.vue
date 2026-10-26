<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CaseSensitive, FileText, Search, X } from 'lucide-vue-next'
import { dirname, type SearchResult } from '@notadown/shared'
import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import { useInjectedCommands } from '@/composables/use-app-commands'

const { t } = useI18n()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const tabs = useTabsStore()
const commands = useInjectedCommands()

const query = ref('')
const caseSensitive = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const showOverlay = computed(() => ui.sidebarOpen && ui.sidebarView === 'search')

const previewParts = (result: SearchResult) => {
  if (!result.preview) return null
  const start = result.previewMatchStart ?? -1
  const length = result.previewMatchLength ?? 0
  if (start < 0 || length <= 0) {
    return { before: result.preview, match: '', after: '' }
  }
  return {
    before: result.preview.slice(0, start),
    match: result.preview.slice(start, start + length),
    after: result.preview.slice(start + length),
  }
}

function runSearch(): void {
  void workspace.search(query.value, caseSensitive.value)
}

function toggleCase(): void {
  caseSensitive.value = !caseSensitive.value
  if (query.value.trim()) runSearch()
}

function clear(): void {
  query.value = ''
  workspace.clearSearch()
  inputRef.value?.focus()
}

async function openResult(result: SearchResult): Promise<void> {
  const tab = await tabs.openWorkspaceFile(result.path)
  if (tab && window.matchMedia('(max-width: 720px)').matches) ui.toggleSidebar(false)
}

function focusInput(): void {
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

watch(query, () => runSearch())

watch(
  () => ui.searchFocusToken,
  () => {
    if (showOverlay.value) focusInput()
  },
)

watch(showOverlay, (open) => {
  if (open) focusInput()
})

watch(
  () => workspace.info?.id,
  () => {
    query.value = ''
    workspace.clearSearch()
  },
)

function openWorkspace(): void {
  void commands.run('file.openWorkspace')
}

function folderOf(path: string): string {
  return dirname(path)
}
</script>

<template>
  <div class="search-panel">
    <div v-if="!workspace.isOpen" class="nd-empty">
      <Search :size="26" :stroke-width="1.5" />
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
    </div>

    <template v-else>
      <div class="search-panel__field">
        <Search :size="14" class="search-panel__icon" />
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="search-panel__input"
          :placeholder="t('sidebar.searchPlaceholder')"
          spellcheck="false"
          @keydown.esc.stop="clear"
        >
        <button
          v-if="query"
          type="button"
          class="search-panel__action"
          :title="t('common.close')"
          @click="clear"
        >
          <X :size="13" />
        </button>
        <button
          type="button"
          class="search-panel__action"
          :class="{ 'is-active': caseSensitive }"
          :title="t('sidebar.searchCaseSensitive')"
          @click="toggleCase"
        >
          <CaseSensitive :size="14" />
        </button>
      </div>

      <div class="search-panel__meta">
        <span v-if="workspace.searching" class="search-panel__status">
          <span class="nd-spinner" />{{ t('sidebar.searchInProgress') }}
        </span>
        <span v-else-if="query.trim()">
          {{ t('sidebar.searchResults', { count: workspace.searchResults.length }) }}
        </span>
      </div>

      <div class="search-panel__results nd-scroll">
        <div v-if="!query.trim()" class="nd-empty">
          <p class="nd-empty-text">{{ t('sidebar.searchHint') }}</p>
        </div>
        <div v-else-if="!workspace.searching && workspace.searchResults.length === 0" class="nd-empty">
          <p class="nd-empty-text">{{ t('sidebar.searchNoResults') }}</p>
        </div>
        <button
          v-for="(result, index) in workspace.searchResults"
          :key="`${result.path}-${result.line ?? 0}-${index}`"
          type="button"
          class="search-result"
          @click="openResult(result)"
        >
          <span class="search-result__head">
            <FileText :size="13" />
            <span class="search-result__name">{{ result.name }}</span>
            <span v-if="result.line" class="search-result__line">:{{ result.line }}</span>
          </span>
          <span v-if="folderOf(result.path)" class="search-result__path">
            {{ folderOf(result.path) }}
          </span>
          <span v-if="previewParts(result)" class="search-result__preview">
            {{ previewParts(result)?.before }}<mark>{{ previewParts(result)?.match }}</mark>{{ previewParts(result)?.after }}
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.search-panel__field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 10px 4px;
  padding: 0 6px 0 9px;
  height: 30px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg);
}

.search-panel__field:focus-within {
  border-color: var(--nd-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--nd-accent) 14%, transparent);
}

.search-panel__icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.search-panel__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  font-size: 12.5px;
  outline: none;
}

.search-panel__input::placeholder {
  color: var(--nd-text-muted);
}

.search-panel__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  color: var(--nd-text-muted);
}

.search-panel__action:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.search-panel__action.is-active {
  background: color-mix(in srgb, var(--nd-accent) 14%, transparent);
  color: var(--nd-accent);
}

.search-panel__meta {
  display: flex;
  align-items: center;
  min-height: 22px;
  padding: 0 14px;
  color: var(--nd-text-muted);
  font-size: 11px;
}

.search-panel__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.search-panel__status .nd-spinner {
  width: 11px;
  height: 11px;
  border-width: 1.5px;
}

.search-panel__results {
  flex: 1;
  padding: 2px 6px 20px;
  overflow-y: auto;
}

.search-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  text-align: left;
}

.search-result:hover {
  background: var(--nd-surface);
}

.search-result__head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--nd-text);
  font-size: 12.5px;
  font-weight: 550;
}

.search-result__head svg {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.search-result__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result__line {
  color: var(--nd-text-muted);
  font-size: 11px;
  font-weight: 400;
}

.search-result__path {
  overflow: hidden;
  padding-left: 19px;
  color: var(--nd-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result__preview {
  overflow: hidden;
  padding-left: 19px;
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result__preview mark {
  border-radius: 2px;
  background: color-mix(in srgb, var(--nd-accent) 22%, transparent);
  color: inherit;
}
</style>
