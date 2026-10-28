<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileText, Maximize2, Minimize2, X } from 'lucide-vue-next'
import {
  createDiffEditor,
  createMarkdownEditor,
  type DiffEditor,
  type MarkdownEditor,
} from '@notadown/editor'
import { formatDateTime, formatNumber, formatRelativeTime } from '@notadown/i18n'
import {
  countWords,
  LARGE_DOCUMENT_THRESHOLD,
  type DocumentRef,
  type HistoryRecord,
} from '@notadown/shared'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { useEditorLabels } from '@/composables/editor-labels'
import { resolveEditorImageUrl } from '@/services/images'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'

type SurfaceMode = 'preview' | 'compare'

const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()
const ui = useUiStore()
const labels = useEditorLabels()

const previewRoot = ref<HTMLDivElement | null>(null)
const diffRoot = ref<HTMLDivElement | null>(null)
const content = ref('')
const mode = ref<SurfaceMode>('preview')
const maximized = ref(false)
const now = ref(Date.now())

let rich: MarkdownEditor | null = null
let diff: DiffEditor | null = null
let mountToken = 0

const record = computed(() => ui.historyRecord)
const matchingTab = computed(() =>
  record.value ? tabs.tabForDocumentKey(record.value.documentKey) : null,
)
const canCompare = computed(() => matchingTab.value !== null)

const historyStats = computed(() => {
  const item = record.value
  if (!item) return null
  return {
    date: formatDateTime(item.createdAt, settings.locale),
    words: formatNumber(countWords(content.value).words, settings.locale),
    size: formatSize(item.size),
  }
})

const currentStats = computed(() => {
  const tab = matchingTab.value
  if (!tab) return null
  return {
    date: tab.mtime === null ? t('sidebar.neverSaved') : formatDateTime(tab.mtime, settings.locale),
    // 磁盘时间可能落后于编辑器里的内容，用悬浮提示说明还有未保存的更改。
    hint: tabs.isDirty(tab) ? t('tabs.unsaved') : '',
    words: formatNumber(countWords(tab.content).words, settings.locale),
    size: formatSize(byteLength(tab.content)),
  }
})

/** 只读预览的图片解析只需要文档 ref：优先跟随已打开的 tab，其次按快照路径重建。 */
function stubRef(): DocumentRef | null {
  const item = record.value
  if (!item) return null
  const tab = matchingTab.value
  if (tab) return tab.ref
  const absolute = /^([a-zA-Z]:[\\/]|\/)/.test(item.filePath)
  if (platform.kind === 'desktop' && absolute) {
    return platform.documentRefForPath(item.filePath)
  }
  if (!absolute) {
    return {
      key: `workspace:${item.filePath}`,
      name: item.fileName,
      path: item.filePath,
      origin: 'workspace',
    }
  }
  return { key: item.documentKey, name: item.fileName, path: null, origin: 'untitled' }
}

function sourceLabel(source: HistoryRecord['source']): string {
  if (source === 'manual') return t('sidebar.snapshotManual')
  if (source === 'restore') return t('sidebar.snapshotRestore')
  return t('sidebar.snapshotAuto')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 与网页版快照同一个口径：UTF-8 编码后的字节数。 */
function byteLength(text: string): number {
  return new Blob([text]).size
}

async function load(item: HistoryRecord): Promise<void> {
  content.value = ''
  mode.value = ui.historyView === 'compare' && canCompare.value ? 'compare' : 'preview'
  const detail = await platform.readHistory(item.id)
  if (ui.historyRecord?.id !== item.id) return
  if (!detail) {
    ui.toast('error', t('toasts.historyLoadFailed'))
    ui.closeHistoryDialog()
    return
  }
  content.value = detail.content
  await nextTick()
  void mountActiveSurface()
}

async function mountActiveSurface(): Promise<void> {
  const token = ++mountToken
  destroySurfaces()
  if (mode.value === 'preview') {
    const root = previewRoot.value
    const item = record.value
    if (!root || !item) return
    const stub = stubRef()
    try {
      const editor = await createMarkdownEditor({
        root,
        markdown: content.value,
        labels: labels.value,
        readOnly: true,
        largeDocument: content.value.length >= LARGE_DOCUMENT_THRESHOLD,
        resolveImageUrl: stub ? (src) => resolveEditorImageUrl(src, { ref: stub }) : undefined,
        onOpenLink: (href) => void safeOpenExternal(href),
      })
      if (token !== mountToken) {
        editor.destroy()
        return
      }
      rich = editor
    } catch (error) {
      ui.toast('error', t('errors.generic'), describeError(error))
    }
    return
  }

  const root = diffRoot.value
  const current = matchingTab.value
  if (!root || !current) return
  try {
    const view = createDiffEditor({
      root,
      original: content.value,
      modified: current.content,
      dark: settings.effectiveMode === 'dark',
      labels: { unchangedLines: t('sidebar.historyUnchangedLines') },
    })
    if (token !== mountToken) {
      view.destroy()
      return
    }
    diff = view
  } catch (error) {
    ui.toast('error', t('errors.generic'), describeError(error))
  }
}

function destroySurfaces(): void {
  rich?.destroy()
  diff?.destroy()
  rich = null
  diff = null
}

async function safeOpenExternal(href: string): Promise<void> {
  try {
    await platform.openExternal(href)
  } catch {
    ui.toast('error', t('toasts.openFailed'))
  }
}

async function switchMode(value: SurfaceMode): Promise<void> {
  if (mode.value === value) return
  if (value === 'compare' && !canCompare.value) return
  mode.value = value
  // 合并视图要在容器可见后创建，否则 CodeMirror 量不到行高。
  await nextTick()
  void mountActiveSurface()
}

function close(): void {
  ui.closeHistoryDialog()
}

async function restore(): Promise<void> {
  const item = record.value
  if (!item) return
  ui.closeHistoryDialog()
  const restored = await tabs.restoreHistory(item.id)
  if (restored) ui.notifyHistoryChanged()
}

watch(
  () => ui.historyRecord?.id,
  () => {
    const item = ui.historyRecord
    destroySurfaces()
    if (item) void load(item)
    else maximized.value = false
  },
  { immediate: true },
)

watch(
  [() => settings.effectiveMode, () => settings.locale],
  () => {
    // 主题色和合并视图的短语都在挂载时固化，改了要重建。
    if (ui.historyRecord && mode.value === 'compare') void mountActiveSurface()
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="record"
        class="nd-overlay nd-overlay--center nd-overlay--history"
        @click.self="close"
      >
        <div
          class="nd-dialog history-dialog"
          :class="{ 'history-dialog--max': maximized }"
          role="dialog"
          aria-modal="true"
        >
          <header class="nd-dialog-header history-dialog__header">
            <h2 class="nd-dialog-title history-dialog__title">
              <FileText :size="15" class="history-dialog__title-icon" />
              <span class="history-dialog__name">{{ record.fileName }}</span>
              <span class="history-dialog__badge">{{ sourceLabel(record.source) }}</span>
            </h2>
            <div class="history-dialog__switch" role="group">
              <button
                type="button"
                class="history-dialog__switch-item"
                :class="{ 'is-active': mode === 'preview' }"
                @click="switchMode('preview')"
              >
                {{ t('sidebar.historyPreview') }}
              </button>
              <button
                type="button"
                class="history-dialog__switch-item"
                :class="{ 'is-active': mode === 'compare' }"
                :disabled="!canCompare"
                :title="canCompare ? '' : t('sidebar.historyCompareDisabled')"
                @click="switchMode('compare')"
              >
                {{ t('sidebar.historyCompare') }}
              </button>
            </div>
            <div class="history-dialog__head-actions">
              <button
                type="button"
                class="nd-icon-btn"
                :title="maximized ? t('common.restore') : t('common.maximize')"
                @click="maximized = !maximized"
              >
                <Minimize2 v-if="maximized" :size="15" />
                <Maximize2 v-else :size="15" />
              </button>
              <button type="button" class="nd-icon-btn" :title="t('common.close')" @click="close">
                <X :size="16" />
              </button>
            </div>
          </header>

          <div class="history-dialog__body">
            <div
              v-show="mode === 'preview'"
              ref="previewRoot"
              class="nd-editor history-dialog__preview"
            />
            <div v-show="mode === 'compare'" class="history-dialog__compare">
              <div class="history-diff__head">
                <div v-if="historyStats" class="history-diff__col is-history">
                  <span class="history-diff__title">{{ t('sidebar.historyVersionLabel') }}</span>
                  <span class="history-diff__stats">
                    <span>{{ t('sidebar.versionDate', { value: historyStats.date }) }}</span>
                    <span>{{ t('sidebar.versionWords', { value: historyStats.words }) }}</span>
                    <span>{{ t('sidebar.versionSize', { value: historyStats.size }) }}</span>
                  </span>
                </div>
                <div v-if="currentStats" class="history-diff__col is-current">
                  <span class="history-diff__title">{{ t('sidebar.currentVersionLabel') }}</span>
                  <span class="history-diff__stats">
                    <span :title="currentStats.hint">
                      {{ t('sidebar.versionDate', { value: currentStats.date }) }}
                    </span>
                    <span>{{ t('sidebar.versionWords', { value: currentStats.words }) }}</span>
                    <span>{{ t('sidebar.versionSize', { value: currentStats.size }) }}</span>
                  </span>
                </div>
              </div>
              <div ref="diffRoot" class="nd-diff-editor history-dialog__diff" />
            </div>
          </div>

          <footer class="nd-dialog-footer history-dialog__footer">
            <span v-show="mode === 'preview'" class="history-dialog__meta">
              {{ formatRelativeTime(record.createdAt, settings.locale, now) }}
              · {{ formatDateTime(record.createdAt, settings.locale) }}
              · {{ formatSize(record.size) }}
            </span>
            <div class="history-dialog__footer-actions">
              <button type="button" class="nd-btn" @click="close">
                {{ t('common.close') }}
              </button>
              <button type="button" class="nd-btn nd-btn--primary" @click="restore">
                {{ t('sidebar.restore') }}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 低于确认弹窗（250），高于其余浮层（100/220）。 */
.nd-overlay--history {
  z-index: 245;
}

.history-dialog {
  width: min(1080px, 96vw);
  height: min(720px, 88vh);
}

/* 放大即铺满遮罩内容盒（遮罩自带 20px 内边距），顺带解除 .nd-dialog 的 80vh 上限。 */
.history-dialog--max {
  width: 100%;
  height: 100%;
  max-height: none;
}

.history-dialog__head-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  justify-self: end;
}

/* 三列栅格让切换器落在弹窗正中：两侧轨道各占一半，标题长短不会把它推着偏。 */
.history-dialog__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
}

.history-dialog__title {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  min-width: 0;
}

.history-dialog__title-icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.history-dialog__name {
  flex: 0 1 auto;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-dialog__badge {
  flex: 0 0 auto;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--nd-surface);
  color: var(--nd-text-secondary);
  font-size: 10.5px;
  font-weight: 550;
}

.history-dialog__switch {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--nd-border);
  border-radius: 99px;
}

.history-dialog__switch-item {
  padding: 3px 12px;
  border: none;
  border-radius: 99px;
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  cursor: pointer;
}

.history-dialog__switch-item:hover:not(:disabled):not(.is-active) {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.history-dialog__switch-item.is-active {
  background: var(--nd-accent);
  color: var(--nd-accent-contrast);
}

.history-dialog__switch-item:disabled {
  opacity: 0.45;
  cursor: default;
}

.history-dialog__body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.history-dialog__preview,
.history-dialog__compare {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.history-dialog__compare {
  display: flex;
  flex-direction: column;
}

/* 表头占掉的高度靠 flex 分配给合并视图，而不是 .nd-diff-editor 自带的 height:100%。 */
.history-dialog__diff {
  flex: 1;
  min-height: 0;
  height: auto;
}

/* 两列宽度用 50/50 近似合并视图的分栏，不画分隔线：竖向滚动条会让真实分栏点偏移半根滚动条宽。 */
.history-diff__head {
  display: flex;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--nd-border);
  background: var(--nd-surface);
}

.history-diff__col {
  display: flex;
  overflow: hidden;
  flex: 1 1 0;
  gap: 10px;
  min-width: 0;
  padding: 5px 10px;
  white-space: nowrap;
}

.history-diff__title {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 600;
}

.history-diff__col.is-history .history-diff__title {
  color: var(--nd-danger);
}

.history-diff__col.is-current .history-diff__title {
  color: var(--nd-success);
}

.history-diff__stats {
  display: flex;
  overflow: hidden;
  gap: 10px;
  min-width: 0;
  color: var(--nd-text-muted);
  font-size: 11px;
}

.history-diff__stats span {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
}

/* 弹窗默认禁止选中文本；只读预览正文要保持可复制。 */
.history-dialog__preview :deep(.ProseMirror),
.history-dialog__compare :deep(.cm-content) {
  user-select: text;
  -webkit-user-select: text;
}

.history-dialog__footer {
  justify-content: space-between;
}

.history-dialog__meta {
  color: var(--nd-text-muted);
  font-size: 11.5px;
}

.history-dialog__footer-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>
