<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CircleAlert, FileWarning, Save } from 'lucide-vue-next'
import {
  createMarkdownEditor,
  createSourceEditor,
  type MarkdownEditor,
  type SourceEditor,
} from '@notadown/editor'
import {
  dirname,
  isOpenableTextFile,
  joinPosix,
  LARGE_DOCUMENT_THRESHOLD,
} from '@notadown/shared'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { registerEditor, type EditorHandle } from '@/editor-registry'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore, type EditorTab } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { useEditorLabels } from '@/composables/editor-labels'
import { resolveEditorImageUrl, saveTabImage } from '@/services/images'

const props = defineProps<{ tab: EditorTab }>()

const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const labels = useEditorLabels()

const richRoot = ref<HTMLDivElement | null>(null)
const sourceRoot = ref<HTMLDivElement | null>(null)
const failed = ref(false)
const largeDocument = computed(
  () => props.tab.content.length >= LARGE_DOCUMENT_THRESHOLD,
)

let rich: MarkdownEditor | null = null
let source: SourceEditor | null = null
let unregister: (() => void) | null = null
let generation = 0

const handle: EditorHandle = {
  focus: () => (rich ?? source)?.focus(),
  flush: () => rich?.flush(),
  find: (query, forward) => rich?.find(query, forward) ?? source?.find(query, forward) ?? null,
  clearFind: () => {
    rich?.clearFind()
    source?.clearFind()
  },
  goToPosition: (pos) => {
    rich?.goToPosition(pos)
    source?.goToPosition(pos)
  },
  runCommand: (command) => rich?.runCommand(command) ?? false,
  setFocusMode: (value) => rich?.setFocusMode(value),
  setTypewriterMode: (value) => rich?.setTypewriterMode(value),
  setReadOnly: (value) => {
    rich?.setReadOnly(value)
    source?.setReadOnly(value)
  },
  refreshLayout: () => rich?.refreshLayout(),
}

onMounted(() => {
  unregister = registerEditor(props.tab.key, handle)
  void rebuild()
})

onBeforeUnmount(() => {
  generation += 1
  unregister?.()
  unregister = null
  destroyEditors()
})

watch(
  () => props.tab.viewMode,
  () => void rebuild(),
)

watch(
  () => props.tab.ref.path,
  () => void rebuild(),
)

watch(
  () => props.tab.reloadToken,
  () => applyStoreContent(),
)

watch(
  () => settings.settings.focusMode,
  (value) => rich?.setFocusMode(value),
)

watch(
  () => settings.settings.typewriterMode,
  (value) => rich?.setTypewriterMode(value),
)

watch(
  () => settings.settings.spellcheck,
  () => applySpellcheck(),
)

async function rebuild(): Promise<void> {
  const token = ++generation
  destroyEditors()
  failed.value = false
  await nextTick()
  if (token !== generation) return

  try {
    if (props.tab.viewMode === 'rich') {
      const editor = await createRichEditor()
      if (!editor) return
      if (token !== generation) {
        editor.destroy()
        return
      }
      rich = editor
      rich.setFocusMode(settings.settings.focusMode)
      rich.setTypewriterMode(settings.settings.typewriterMode)
    } else {
      const root = sourceRoot.value
      if (!root) return
      source = createSourceEditor({
        root,
        value: props.tab.content,
        labels: labels.value,
        spellcheck: settings.settings.spellcheck,
        readOnly: false,
        largeDocument: largeDocument.value,
        onChange: (value) => tabs.updateContent(props.tab.key, value),
        onSave: () => void tabs.saveTab(props.tab),
      })
    }
    applySpellcheck()
  } catch (error) {
    failed.value = true
    ui.toast('error', t('errors.generic'), describeError(error))
  }
}

async function createRichEditor(): Promise<MarkdownEditor | null> {
  const root = richRoot.value
  if (!root) return null
  return createMarkdownEditor({
    root,
    markdown: props.tab.content,
    labels: labels.value,
    spellcheck: settings.settings.spellcheck,
    focusMode: settings.settings.focusMode,
    typewriterMode: settings.settings.typewriterMode,
    largeDocument: largeDocument.value,
    onChange: (markdown) => tabs.updateContent(props.tab.key, markdown),
    onOutlineChange: (outline) => tabs.setOutline(props.tab.key, outline),
    onOpenLink: (href) => void openLink(href),
    uploadImage: async (file) => {
      try {
        return await saveTabImage(file, props.tab)
      } catch (error) {
        ui.toast('error', t('editor.image.uploadFailed'), describeError(error))
        throw error
      }
    },
    resolveImageUrl: (src) => resolveEditorImageUrl(src, props.tab),
  })
}

function destroyEditors(): void {
  rich?.flush()
  rich?.destroy()
  source?.destroy()
  rich = null
  source = null
}

function applyStoreContent(): void {
  const content = props.tab.content
  if (props.tab.viewMode === 'rich') {
    if (rich && rich.getMarkdown() !== content) rich.setMarkdown(content, { silent: true })
  } else if (source && source.getValue() !== content) {
    source.setValue(content)
  }
}

function applySpellcheck(): void {
  const value = settings.settings.spellcheck
  const richDom = richRoot.value?.querySelector<HTMLElement>('.ProseMirror')
  if (richDom) richDom.spellcheck = value
  const sourceDom = sourceRoot.value?.querySelector<HTMLElement>('.cm-content')
  if (sourceDom) sourceDom.setAttribute('spellcheck', String(value))
}

async function openLink(href: string): Promise<void> {
  if (!href || href.startsWith('#')) return
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && workspace.isOpen && props.tab.ref.path) {
    const target = href.split('#')[0]
    const path = joinPosix(dirname(props.tab.ref.path), target)
    if (target && isOpenableTextFile(path) && workspace.hasEntry(path)) {
      void tabs.openWorkspaceFile(path)
      return
    }
  }
  try {
    await platform.openExternal(href)
  } catch {
    ui.toast('error', t('toasts.openFailed'))
  }
}

function keepDisk(): void {
  tabs.resolveConflict(props.tab.key, 'disk')
}

function keepMine(): void {
  tabs.resolveConflict(props.tab.key, 'mine')
}

function saveAsNew(): void {
  void tabs.saveAsTab(props.tab)
}
</script>

<template>
  <div class="editor-tab">
    <div v-if="tab.conflict" class="editor-banner editor-banner--warning">
      <CircleAlert :size="15" class="editor-banner__icon" />
      <p class="editor-banner__text">
        <strong>{{ t('dialogs.conflictTitle') }}</strong>
        {{ t('dialogs.conflictMessage', { name: tab.name }) }}
      </p>
      <div class="editor-banner__actions">
        <button type="button" class="nd-btn nd-btn--sm" @click="keepDisk">
          {{ t('dialogs.reloadFromDisk') }}
        </button>
        <button type="button" class="nd-btn nd-btn--sm nd-btn--primary" @click="keepMine">
          {{ t('dialogs.keepMyVersion') }}
        </button>
      </div>
    </div>

    <div v-else-if="tab.missing" class="editor-banner editor-banner--danger">
      <FileWarning :size="15" class="editor-banner__icon" />
      <p class="editor-banner__text">
        <strong>{{ t('dialogs.fileMissingTitle') }}</strong>
        {{ t('dialogs.fileMissingMessage', { name: tab.name }) }}
      </p>
      <div class="editor-banner__actions">
        <button type="button" class="nd-btn nd-btn--sm" @click="saveAsNew">
          <Save :size="13" />
          {{ t('dialogs.saveAsNew') }}
        </button>
      </div>
    </div>

    <div class="editor-tab__surface">
      <div v-show="tab.viewMode === 'rich'" ref="richRoot" class="editor-tab__rich" />
      <div
        v-show="tab.viewMode === 'source'"
        ref="sourceRoot"
        class="nd-source-editor editor-tab__source"
      />
      <div v-if="failed" class="editor-tab__failure">
        <p class="nd-empty-text">{{ t('errors.generic') }}</p>
        <button type="button" class="nd-btn nd-btn--sm" @click="rebuild">
          {{ t('common.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.editor-tab__surface {
  position: relative;
  flex: 1;
  min-height: 0;
}

.editor-tab__rich,
.editor-tab__source {
  position: absolute;
  inset: 0;
}

.editor-tab__source {
  overflow: hidden;
}

.editor-banner {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--nd-border);
  font-size: 12px;
  line-height: 1.5;
}

.editor-banner--warning {
  background: color-mix(in srgb, var(--nd-warning) 9%, var(--nd-bg));
  color: var(--nd-text);
}

.editor-banner--danger {
  background: color-mix(in srgb, var(--nd-danger) 8%, var(--nd-bg));
  color: var(--nd-text);
}

.editor-banner__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--nd-warning);
}

.editor-banner--danger .editor-banner__icon {
  color: var(--nd-danger);
}

.editor-banner__text {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--nd-text-secondary);
}

.editor-banner__text strong {
  margin-right: 5px;
  color: var(--nd-text);
}

.editor-banner__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.editor-tab__failure {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--nd-bg);
}
</style>
