<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileText, FolderOpen, Search } from 'lucide-vue-next'
import { dirname, type FileEntry } from '@notadown/shared'
import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'
import { useTabsStore } from '@/stores/tabs'
import { useWorkspaceStore } from '@/stores/workspace'
import { useInjectedCommands } from '@/composables/use-app-commands'

const { t } = useI18n()
const ui = useUiStore()
const tabs = useTabsStore()
const workspace = useWorkspaceStore()
const commands = useInjectedCommands()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const results = ref<FileEntry[]>([])
const searching = ref(false)

let searchToken = 0
let searchTimer: number | null = null

function scheduleSearch(): void {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = null
  const token = ++searchToken
  if (!workspace.isOpen) {
    searching.value = false
    results.value = []
    return
  }
  searching.value = true
  searchTimer = window.setTimeout(() => {
    searchTimer = null
    void platform
      .findWorkspaceFiles(query.value.trim(), 80)
      .then((files) => {
        if (token === searchToken) results.value = files
      })
      .catch(() => {
        if (token === searchToken) results.value = []
      })
      .finally(() => {
        if (token === searchToken) searching.value = false
      })
  }, 120)
}

watch(
  () => ui.quickOpenOpen,
  async (open) => {
    if (!open) return
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
    if (workspace.isOpen) void workspace.refresh()
    scheduleSearch()
  },
)

watch(query, () => {
  activeIndex.value = 0
  scheduleSearch()
})

watch(activeIndex, async () => {
  await nextTick()
  const element = listRef.value?.children[activeIndex.value]
  if (element instanceof HTMLElement) element.scrollIntoView({ block: 'nearest' })
})

function close(): void {
  ui.quickOpenOpen = false
}

function openFolder(): void {
  close()
  void commands.run('file.openWorkspace')
}

function openResult(index: number): void {
  const entry = results.value[index]
  if (!entry) return
  close()
  void tabs.openWorkspaceFile(entry.path)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value = (activeIndex.value + 1) % results.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    openResult(activeIndex.value)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div v-if="ui.quickOpenOpen" class="nd-overlay" @click.self="close">
        <div class="nd-dialog quick-open" role="dialog" aria-modal="true">
          <div class="quick-open__search">
            <Search :size="16" class="quick-open__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="quick-open__input"
              :placeholder="t('command.quickOpenPlaceholder')"
              @keydown="onKeydown"
            />
          </div>

          <div v-if="!workspace.isOpen" class="nd-empty quick-open__empty">
            <FolderOpen :size="24" :stroke-width="1.5" />
            <div class="nd-empty-title">{{ t('sidebar.noWorkspace') }}</div>
            <p class="nd-empty-text">{{ t('sidebar.noWorkspaceHint') }}</p>
            <button type="button" class="nd-btn nd-btn--sm" @click="openFolder">
              {{ t('sidebar.openFolder') }}
            </button>
          </div>

          <div v-else-if="searching && results.length === 0" class="nd-empty quick-open__empty">
            <p class="nd-empty-text">{{ t('sidebar.searchInProgress') }}</p>
          </div>

          <div v-else-if="results.length === 0" class="nd-empty quick-open__empty">
            <p class="nd-empty-text">{{ t('command.noFiles') }}</p>
          </div>

          <ul v-else ref="listRef" class="quick-open__list nd-scroll">
            <li v-for="(entry, index) in results" :key="entry.path">
              <button
                type="button"
                class="quick-open__item"
                :class="{ 'is-active': index === activeIndex }"
                @mousemove="activeIndex = index"
                @click="openResult(index)"
              >
                <FileText :size="14" class="quick-open__file-icon" />
                <span class="quick-open__name">{{ entry.name }}</span>
                <span class="quick-open__dir">
                  {{ dirname(entry.path) || workspace.info?.name }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.quick-open {
  width: min(600px, 100%);
  max-height: 62vh;
  padding: 0;
}

.quick-open__search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--nd-border);
}

.quick-open__icon {
  position: absolute;
  left: 16px;
  color: var(--nd-text-muted);
  pointer-events: none;
}

.quick-open__input {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 42px;
  border: none;
  background: transparent;
  color: var(--nd-text);
  font-size: 14px;
  outline: none;
}

.quick-open__input::placeholder {
  color: var(--nd-text-muted);
}

.quick-open__list {
  flex: 1;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
}

.quick-open__item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  color: var(--nd-text);
  font-size: 12.5px;
  text-align: left;
}

.quick-open__item.is-active {
  background: var(--nd-surface);
}

.quick-open__file-icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.quick-open__name {
  overflow: hidden;
  flex: 0 1 auto;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open__dir {
  overflow: hidden;
  flex: 1;
  color: var(--nd-text-muted);
  font-size: 11px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open__empty {
  flex: none;
  padding: 28px;
}
</style>
