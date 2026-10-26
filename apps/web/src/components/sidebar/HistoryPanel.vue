<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FileText,
  History as HistoryIcon,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-vue-next'
import { formatDateTime, formatRelativeTime } from '@notadown/i18n'
import { dirname, type HistoryRecord } from '@notadown/shared'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()
const ui = useUiStore()
const workspace = useWorkspaceStore()

const records = ref<HistoryRecord[]>([])
const loading = ref(false)
const showAll = ref(true)
const now = ref(Date.now())
let requestToken = 0
let clock: number | null = null

const active = computed(() => tabs.activeTab)
const filterKey = computed(() =>
  showAll.value ? undefined : (tabs.activeDocumentKey ?? undefined),
)
const canFilterCurrent = computed(() => tabs.activeDocumentKey !== null)

const currentKey = computed(() => tabs.activeDocumentKey)

function sourceLabel(source: HistoryRecord['source']): string {
  if (source === 'manual') return t('sidebar.snapshotManual')
  if (source === 'restore') return t('sidebar.snapshotRestore')
  return t('sidebar.snapshotAuto')
}

function isDeleted(record: HistoryRecord): boolean {
  if (!workspace.isOpen) return false
  if (!record.documentKey.startsWith('workspace:')) return false
  // Unloaded folders are unknown territory: only report deletion for folders we actually listed.
  if (!workspace.directoryLoaded(dirname(record.filePath))) return false
  return !workspace.entryPaths.has(record.filePath)
}

async function refresh(): Promise<void> {
  if (!platform.capabilities.localHistory) {
    records.value = []
    return
  }
  const token = ++requestToken
  loading.value = true
  try {
    const list = await platform.listHistory(filterKey.value)
    if (token === requestToken) records.value = list
  } catch {
    if (token === requestToken) records.value = []
  } finally {
    if (token === requestToken) loading.value = false
  }
}

async function restore(record: HistoryRecord): Promise<void> {
  const restored = await tabs.restoreHistory(record.id)
  if (restored) await refresh()
}

async function remove(record: HistoryRecord): Promise<void> {
  const confirmed = await ui.confirm({
    title: t('common.delete'),
    message: `${record.fileName} · ${formatDateTime(record.createdAt, settings.locale)}`,
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    danger: true,
  })
  if (!confirmed) return
  try {
    await platform.deleteHistory(record.id)
    records.value = records.value.filter((item) => item.id !== record.id)
  } catch {
    ui.toast('error', t('errors.generic'))
  }
}

function toggleFilter(): void {
  if (!showAll.value) {
    showAll.value = true
    return
  }
  if (!canFilterCurrent.value) return
  showAll.value = false
}

watch(
  () => ui.sidebarView,
  (view) => {
    if (view === 'history') void refresh()
  },
)

watch(filterKey, () => {
  if (ui.sidebarView === 'history') void refresh()
})

watch(
  () => ui.sidebarOpen,
  (open) => {
    if (open && ui.sidebarView === 'history') void refresh()
  },
)

onMounted(() => {
  clock = window.setInterval(() => {
    now.value = Date.now()
  }, 30_000)
  if (ui.sidebarView === 'history') void refresh()
})

onBeforeUnmount(() => {
  if (clock) window.clearInterval(clock)
})
</script>

<template>
  <div class="history-panel">
    <div class="history-toolbar">
      <button
        type="button"
        class="history-filter"
        :class="{ 'is-current': !showAll }"
        :disabled="showAll && !canFilterCurrent"
        :title="showAll ? t('sidebar.historyAll') : active?.name"
        @click="toggleFilter"
      >
        <HistoryIcon :size="13" />
        <span class="history-filter__label">
          {{
            showAll
              ? t('sidebar.historyAll')
              : t('sidebar.historyFor', { name: active?.name ?? '' })
          }}
        </span>
      </button>
      <button
        type="button"
        class="nd-icon-btn"
        :title="t('common.reload')"
        @click="refresh"
      >
        <RefreshCw :size="13" :class="{ 'is-spinning': loading }" />
      </button>
    </div>

    <div v-if="!platform.capabilities.localHistory" class="nd-empty">
      <HistoryIcon :size="26" :stroke-width="1.5" />
      <p class="nd-empty-text">{{ t('toasts.browserNoHistory') }}</p>
    </div>

    <div v-else-if="records.length === 0 && !loading" class="nd-empty">
      <HistoryIcon :size="26" :stroke-width="1.5" />
      <div class="nd-empty-title">{{ t('sidebar.historyEmpty') }}</div>
      <p class="nd-empty-text">{{ t('sidebar.historyHint') }}</p>
    </div>

    <div v-else class="history-panel__list nd-scroll">
      <div v-for="record in records" :key="record.id" class="history-row">
        <div class="history-row__head">
          <FileText :size="13" class="history-row__icon" />
          <span class="history-row__name">{{ record.fileName }}</span>
          <span v-if="isDeleted(record)" class="history-row__deleted" :title="t('sidebar.deletedFile')">
            <TriangleAlert :size="12" />
          </span>
        </div>
        <div class="history-row__meta">
          <span :title="formatDateTime(record.createdAt, settings.locale)">
            {{ formatRelativeTime(record.createdAt, settings.locale, now) }}
          </span>
          <span class="history-row__source" :class="`is-${record.source}`">
            {{ sourceLabel(record.source) }}
          </span>
          <span v-if="record.documentKey === currentKey" class="history-row__current">
            {{ t('sidebar.currentWorkspace') }}
          </span>
        </div>
        <div class="history-row__actions">
          <button
            type="button"
            class="nd-icon-btn history-row__action"
            :title="t('sidebar.restore')"
            @click="restore(record)"
          >
            <RotateCcw :size="13" />
          </button>
          <button
            type="button"
            class="nd-icon-btn history-row__action"
            :title="t('common.delete')"
            @click="remove(record)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.history-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 10px;
}

.history-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--nd-border);
  border-radius: 99px;
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 11.5px;
}

.history-filter:hover:not(:disabled) {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.history-filter:disabled {
  opacity: 0.6;
}

.history-filter.is-current {
  border-color: color-mix(in srgb, var(--nd-accent) 35%, var(--nd-border));
  color: var(--nd-accent);
}

.history-filter__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-panel__list {
  flex: 1;
  padding: 2px 6px 20px;
  overflow-y: auto;
}

.history-row {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 8px;
  border-radius: var(--nd-radius-sm);
}

.history-row:hover {
  background: var(--nd-surface);
}

.history-row__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding-right: 46px;
  color: var(--nd-text);
  font-size: 12.5px;
  font-weight: 550;
}

.history-row__icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.history-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-row__deleted {
  display: inline-flex;
  color: var(--nd-warning);
}

.history-row__meta {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-left: 19px;
  color: var(--nd-text-muted);
  font-size: 11px;
}

.history-row__source {
  padding: 0 5px;
  border-radius: 4px;
  background: var(--nd-surface-hover);
  font-size: 10px;
}

.history-row__source.is-manual {
  color: var(--nd-accent);
}

.history-row__source.is-restore {
  color: var(--nd-warning);
}

.history-row__current {
  color: var(--nd-accent);
  font-size: 10px;
}

.history-row__actions {
  position: absolute;
  top: 5px;
  right: 6px;
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.history-row:hover .history-row__actions,
.history-row:focus-within .history-row__actions {
  opacity: 1;
}

.history-row__action {
  width: 22px;
  height: 22px;
}

.is-spinning {
  animation: nd-spin 0.9s linear infinite;
}
</style>
