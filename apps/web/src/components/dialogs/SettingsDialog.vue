<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Download,
  Image,
  Info,
  Keyboard,
  Palette,
  RefreshCw,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Type,
  History,
  ExternalLink,
  FolderOpen,
  X,
} from 'lucide-vue-next'
import {
  DEFAULT_SETTINGS,
  THEMES,
  buildImageFileName,
  getThemeTokens,
  type AppSettings,
  type ColorMode,
  type ImageStorageMode,
  type LocalePreference,
  type PageWidthMode,
  type ThemeId,
} from '@notadown/shared'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@notadown/i18n'
import { platform } from '@/platform'
import { PAGE_WIDTH_MODES } from '@/page-widths'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUpdateStore } from '@/stores/update'
import { useUiStore, type SettingsSection } from '@/stores/ui'
import { appliedTitleBarMode } from '@/window-chrome'
import ShortcutsList from '../common/ShortcutsList.vue'
import BrandMark from '../common/BrandMark.vue'

const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()
const update = useUpdateStore()
const ui = useUiStore()
const isDesktop = platform.kind === 'desktop'
const canDefaultAppSettings = platform.capabilities.defaultAppSettings
const REPOSITORY_URL = 'https://github.com/NotaDown/NotaDown'

const draft = reactive<AppSettings>({ ...settings.settings })
const section = ref<SettingsSection>(ui.settingsSection)
const cssInput = ref<HTMLInputElement | null>(null)
const recreating = ref(false)

const titleBarRecreatePending = computed(
  () => isDesktop && draft.titleBarMode !== appliedTitleBarMode.value,
)

interface SettingsSectionItem {
  id: SettingsSection
  icon: typeof Info
  label: string
}

const ALL_SECTIONS: SettingsSectionItem[] = [
  { id: 'general', icon: SlidersHorizontal, label: 'settings.general' },
  { id: 'appearance', icon: Palette, label: 'settings.appearance' },
  { id: 'editor', icon: Type, label: 'settings.editor' },
  { id: 'files', icon: Image, label: 'settings.files' },
  { id: 'history', icon: History, label: 'settings.history' },
  { id: 'shortcuts', icon: Keyboard, label: 'settings.shortcuts' },
  { id: 'updates', icon: Download, label: 'settings.updates' },
  { id: 'about', icon: Info, label: 'settings.about' },
]

const SECTIONS = ALL_SECTIONS.filter((item) => isDesktop || item.id !== 'updates')

const COLOR_MODES: Array<{ id: ColorMode; label: string }> = [
  { id: 'system', label: 'settings.appearanceSection.system' },
  { id: 'light', label: 'settings.appearanceSection.light' },
  { id: 'dark', label: 'settings.appearanceSection.dark' },
]

const IMAGE_MODES: Array<{ id: ImageStorageMode; label: string }> = [
  { id: 'document-assets', label: 'settings.filesSection.modes.document-assets' },
  { id: 'document-named', label: 'settings.filesSection.modes.document-named' },
  { id: 'global-attachments', label: 'settings.filesSection.modes.global-attachments' },
  { id: 'base64', label: 'settings.filesSection.modes.base64' },
]

type NumericSettingKey =
  | 'fontSize'
  | 'lineHeight'
  | 'autosaveDelay'
  | 'historyIntervalMinutes'
  | 'historyMaxPerFile'
  | 'historyRetentionDays'

const NUMBER_LIMITS: Record<
  NumericSettingKey,
  { min: number; max: number; step: number }
> = {
  fontSize: { min: 12, max: 32, step: 1 },
  lineHeight: { min: 1.2, max: 2.6, step: 0.05 },
  autosaveDelay: { min: 200, max: 10000, step: 100 },
  historyIntervalMinutes: { min: 1, max: 120, step: 1 },
  historyMaxPerFile: { min: 5, max: 1000, step: 5 },
  historyRetentionDays: { min: 1, max: 3650, step: 1 },
}

const localeOptions = computed<Array<{ id: LocalePreference; label: string }>>(() => [
  { id: 'system', label: t('settings.generalSection.languageSystem') },
  ...SUPPORTED_LOCALES.map((id) => ({ id, label: LOCALE_NAMES[id] })),
])

const patternPreview = computed(() =>
  buildImageFileName(
    draft.imageFileNamePattern || DEFAULT_SETTINGS.imageFileNamePattern,
    {
      documentName: t('app.untitled'),
      originalName: 'screenshot.png',
      extension: 'png',
    },
  ),
)

watch(
  draft,
  () => {
    settings.update({ ...draft })
  },
  { deep: true },
)

watch(
  () => ui.settingsOpen,
  (open) => {
    if (!open) return
    Object.assign(draft, settings.settings)
    section.value = ui.settingsSection
  },
)

watch(
  () => ui.settingsSection,
  (value) => {
    if (ui.settingsOpen) section.value = value
  },
)

const canRevealHistoryDir = platform.capabilities.revealInFolder
const historyDirPath = ref('')

watch(
  [section, () => ui.settingsOpen],
  ([nextSection, open]) => {
    if (!open || !canRevealHistoryDir || nextSection !== 'history') return
    if (historyDirPath.value) return
    void platform
      .historyDir()
      .then((dir) => {
        historyDirPath.value = dir
      })
      .catch(() => undefined)
  },
)

function close(): void {
  ui.settingsOpen = false
}

function selectSection(id: SettingsSection): void {
  section.value = id
}

function themeSwatches(id: ThemeId): string[] {
  const tokens = getThemeTokens(id, settings.effectiveMode)
  return [tokens.bg, tokens.surface, tokens.text, tokens.accent]
}

function setLocale(event: Event): void {
  draft.locale = (event.target as HTMLSelectElement).value as LocalePreference
}

function setExtension(event: Event): void {
  draft.defaultFileExtension = (event.target as HTMLSelectElement).value as 'md' | 'markdown'
}

function setTitleBarMode(event: Event): void {
  draft.titleBarMode =
    (event.target as HTMLSelectElement).value === 'native' ? 'native' : 'integrated'
}

function chooseTheme(id: ThemeId): void {
  draft.theme = id
}

function chooseColorMode(id: ColorMode): void {
  draft.colorMode = id
}

function choosePageWidth(id: PageWidthMode): void {
  draft.pageWidth = id
}

const previewMaxWidth = computed(() => {
  switch (draft.pageWidth) {
    case 'narrow':
      return '460px'
    case 'default':
      return '500px'
    case 'wide':
      return '560px'
    case 'full':
      return '100%'
    default:
      return '420px'
  }
})

function chooseImageMode(id: ImageStorageMode): void {
  draft.imageStorage = id
}

function commitNumber(key: NumericSettingKey, event: Event): void {
  const input = event.target as HTMLInputElement
  const { min, max } = NUMBER_LIMITS[key]
  const parsed = input.valueAsNumber
  const value = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : draft[key]
  draft[key] = Math.round(value * 100) / 100
  input.value = String(draft[key])
}

function pickCssFile(): void {
  cssInput.value?.click()
}

async function loadCssFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) draft.customCss = await file.text()
  input.value = ''
}

async function resetSettings(): Promise<void> {
  const confirmed = await ui.confirm({
    title: t('settings.reset'),
    message: t('settings.resetConfirm'),
    confirmLabel: t('common.reset'),
    cancelLabel: t('common.cancel'),
  })
  if (!confirmed) return
  settings.reset()
  await nextTick()
  Object.assign(draft, settings.settings)
}

async function recreateWindow(): Promise<void> {
  const bridge = window.notadown
  if (!bridge || recreating.value) return
  if (tabs.hasDirty) {
    ui.toast('warning', t('settings.generalSection.recreateUnsaved'))
    return
  }
  recreating.value = true
  try {
    await platform.saveSettings(settings.snapshot())
    await bridge.invoke('recreateWindow')
  } catch {
    ui.toast('error', t('errors.generic'))
  } finally {
    recreating.value = false
  }
}

async function openDefaultAppSettings(): Promise<void> {
  try {
    await platform.openDefaultAppSettings()
  } catch {
    ui.toast('error', t('defaultApp.openFailed'))
  }
}

async function openRepository(): Promise<void> {
  try {
    await platform.openExternal(REPOSITORY_URL)
  } catch {
    ui.toast('error', t('toasts.openFailed'))
  }
}

async function openHistoryDir(): Promise<void> {
  try {
    await platform.openHistoryDir()
  } catch {
    ui.toast('error', t('settings.historySection.openFailed'))
  }
}

async function clearHistory(): Promise<void> {
  const confirmed = await ui.confirm({
    title: t('dialogs.deleteHistoryTitle'),
    message: t('settings.historySection.clearConfirm'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    danger: true,
  })
  if (!confirmed) return
  try {
    await platform.clearHistory()
    ui.toast('success', t('settings.historySection.cleared'))
  } catch {
    ui.toast('error', t('errors.generic'))
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div v-if="ui.settingsOpen" class="nd-overlay nd-overlay--center" @click.self="close">
        <div class="nd-dialog settings-dialog" role="dialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ t('settings.title') }}</h2>
            <button type="button" class="nd-icon-btn" :title="t('common.close')" @click="close">
              <X :size="16" />
            </button>
          </header>

          <div class="settings-dialog__layout">
            <nav class="settings-nav">
              <button
                v-for="item in SECTIONS"
                :key="item.id"
                type="button"
                class="settings-nav__item"
                :class="{ 'is-active': section === item.id }"
                @click="selectSection(item.id)"
              >
                <component :is="item.icon" :size="15" :stroke-width="1.7" />
                {{ t(item.label) }}
              </button>
            </nav>

            <div class="settings-content nd-scroll">
              <section v-if="section === 'general'" class="settings-section">
                <div class="nd-field">
                  <label class="nd-field-label" for="settings-locale">
                    {{ t('settings.generalSection.language') }}
                  </label>
                  <select
                    id="settings-locale"
                    class="nd-select"
                    :value="draft.locale"
                    @change="setLocale"
                  >
                    <option v-for="option in localeOptions" :key="option.id" :value="option.id">
                      {{ option.label }}
                    </option>
                  </select>
                </div>

                <div class="nd-field-row">
                  <div>
                    <label class="nd-field-label" for="settings-restore">
                      {{ t('settings.generalSection.restoreSession') }}
                    </label>
                    <p class="nd-field-hint">{{ t('settings.generalSection.restoreSessionHint') }}</p>
                  </div>
                  <label class="nd-switch nd-field-control">
                    <input id="settings-restore" v-model="draft.restoreSession" type="checkbox" />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <div>
                    <label class="nd-field-label" for="settings-confirm-delete">
                      {{ t('settings.generalSection.confirmDelete') }}
                    </label>
                    <p class="nd-field-hint">{{ t('settings.generalSection.confirmDeleteHint') }}</p>
                  </div>
                  <label class="nd-switch nd-field-control">
                    <input
                      id="settings-confirm-delete"
                      v-model="draft.confirmDelete"
                      type="checkbox"
                    />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div v-if="isDesktop" class="nd-field">
                  <label class="nd-field-label" for="settings-title-bar">
                    {{ t('settings.generalSection.titleBar') }}
                  </label>
                  <select
                    id="settings-title-bar"
                    class="nd-select"
                    :value="draft.titleBarMode"
                    @change="setTitleBarMode"
                  >
                    <option value="integrated">
                      {{ t('settings.generalSection.titleBarIntegrated') }}
                    </option>
                    <option value="native">
                      {{ t('settings.generalSection.titleBarNative') }}
                    </option>
                  </select>
                  <p class="nd-field-hint">{{ t('settings.generalSection.titleBarHint') }}</p>
                  <div v-if="titleBarRecreatePending" class="settings-recreate">
                    <span class="settings-recreate__notice">
                      {{ t('settings.generalSection.titleBarRecreateNotice') }}
                    </span>
                    <button
                      type="button"
                      class="nd-btn nd-btn--primary nd-btn--sm"
                      :disabled="recreating"
                      @click="recreateWindow"
                    >
                      <RotateCw :size="13" />
                      {{ t('settings.generalSection.recreateWindow') }}
                    </button>
                  </div>
                </div>

                <div v-if="canDefaultAppSettings" class="nd-field">
                  <span class="nd-field-label">
                    {{ t('settings.generalSection.defaultMarkdownApp') }}
                  </span>
                  <p class="nd-field-hint">
                    {{ t('settings.generalSection.defaultMarkdownAppHint') }}
                  </p>
                  <button
                    type="button"
                    class="nd-btn nd-btn--sm"
                    @click="openDefaultAppSettings"
                  >
                    <ExternalLink :size="13" />
                    {{ t('defaultApp.openSettings') }}
                  </button>
                </div>
              </section>

              <section v-else-if="section === 'appearance'" class="settings-section">
                <div class="nd-field">
                  <span class="nd-field-label">{{ t('settings.appearanceSection.colorMode') }}</span>
                  <div class="segmented">
                    <button
                      v-for="mode in COLOR_MODES"
                      :key="mode.id"
                      type="button"
                      class="segmented__item"
                      :class="{ 'is-active': draft.colorMode === mode.id }"
                      @click="chooseColorMode(mode.id)"
                    >
                      {{ t(mode.label) }}
                    </button>
                  </div>
                </div>

                <div class="nd-field">
                  <span class="nd-field-label">{{ t('settings.appearanceSection.theme') }}</span>
                  <div class="theme-grid">
                    <button
                      v-for="theme in THEMES"
                      :key="theme.id"
                      type="button"
                      class="theme-card"
                      :class="{ 'is-active': draft.theme === theme.id }"
                      @click="chooseTheme(theme.id)"
                    >
                      <span class="theme-card__swatch">
                        <span
                          v-for="(color, index) in themeSwatches(theme.id)"
                          :key="index"
                          class="theme-card__color"
                          :style="{ background: color }"
                        />
                      </span>
                      <span class="theme-card__name">{{ t(theme.nameKey) }}</span>
                    </button>
                  </div>
                </div>

                <div class="nd-field">
                  <span class="nd-field-label">
                    {{ t('settings.appearanceSection.pageWidth') }}
                  </span>
                  <div class="segmented">
                    <button
                      v-for="mode in PAGE_WIDTH_MODES"
                      :key="mode.id"
                      type="button"
                      class="segmented__item"
                      :class="{ 'is-active': draft.pageWidth === mode.id }"
                      @click="choosePageWidth(mode.id)"
                    >
                      {{ t(mode.label) }}
                    </button>
                  </div>
                </div>

                <div class="nd-field">
                  <label class="nd-field-label" for="settings-font-family">
                    {{ t('settings.appearanceSection.fontFamily') }}
                  </label>
                  <input
                    id="settings-font-family"
                    v-model="draft.fontFamily"
                    class="nd-input"
                    type="text"
                    placeholder="Inter, Georgia, …"
                  />
                  <p class="nd-field-hint">{{ t('settings.appearanceSection.fontFamilyHint') }}</p>
                </div>

                <div class="nd-field-row">
                  <label class="nd-field-label" for="settings-monospace">
                    {{ t('settings.appearanceSection.monospace') }}
                  </label>
                  <label class="nd-switch nd-field-control">
                    <input
                      id="settings-monospace"
                      v-model="draft.editorFontMonospace"
                      type="checkbox"
                    />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <div>
                    <span class="nd-field-label">{{ t('settings.appearanceSection.fontSize') }}</span>
                  </div>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.fontSize"
                      type="range"
                      :min="NUMBER_LIMITS.fontSize.min"
                      :max="NUMBER_LIMITS.fontSize.max"
                      :step="NUMBER_LIMITS.fontSize.step"
                      :aria-label="t('settings.appearanceSection.fontSize')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.fontSize"
                      :min="NUMBER_LIMITS.fontSize.min"
                      :max="NUMBER_LIMITS.fontSize.max"
                      :step="NUMBER_LIMITS.fontSize.step"
                      :aria-label="t('settings.appearanceSection.fontSize')"
                      @change="commitNumber('fontSize', $event)"
                    />
                    <span class="settings-slider__unit">px</span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <div>
                    <span class="nd-field-label">{{ t('settings.appearanceSection.lineHeight') }}</span>
                  </div>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.lineHeight"
                      type="range"
                      :min="NUMBER_LIMITS.lineHeight.min"
                      :max="NUMBER_LIMITS.lineHeight.max"
                      :step="NUMBER_LIMITS.lineHeight.step"
                      :aria-label="t('settings.appearanceSection.lineHeight')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.lineHeight"
                      :min="NUMBER_LIMITS.lineHeight.min"
                      :max="NUMBER_LIMITS.lineHeight.max"
                      step="0.01"
                      :aria-label="t('settings.appearanceSection.lineHeight')"
                      @change="commitNumber('lineHeight', $event)"
                    />
                    <span class="settings-slider__unit" aria-hidden="true" />
                  </div>
                </div>

                <div class="nd-field">
                  <span class="nd-field-label">{{ t('settings.appearanceSection.preview') }}</span>
                  <div
                    class="settings-preview"
                    :style="{
                      fontFamily: draft.fontFamily || undefined,
                      fontSize: `${draft.fontSize}px`,
                      lineHeight: String(draft.lineHeight),
                      maxWidth: previewMaxWidth,
                    }"
                  >
                    {{ t('settings.appearanceSection.previewText') }}
                  </div>
                </div>

                <div class="nd-field">
                  <label class="nd-field-label" for="settings-custom-css">
                    {{ t('settings.appearanceSection.customCss') }}
                  </label>
                  <p class="nd-field-hint">{{ t('settings.appearanceSection.customCssHint') }}</p>
                  <textarea
                    id="settings-custom-css"
                    v-model="draft.customCss"
                    class="nd-textarea settings-css"
                    spellcheck="false"
                    :placeholder="t('settings.appearanceSection.customCssPlaceholder')"
                  />
                  <div class="settings-inline-actions">
                    <input
                      ref="cssInput"
                      type="file"
                      accept=".css,text/css"
                      class="settings-file-input"
                      @change="loadCssFile"
                    />
                    <button type="button" class="nd-btn nd-btn--sm" @click="pickCssFile">
                      {{ t('settings.appearanceSection.loadCss') }}
                    </button>
                    <button
                      type="button"
                      class="nd-btn nd-btn--sm"
                      :disabled="!draft.customCss"
                      @click="draft.customCss = ''"
                    >
                      {{ t('settings.appearanceSection.clearCss') }}
                    </button>
                  </div>
                </div>
              </section>

              <section v-else-if="section === 'editor'" class="settings-section">
                <div class="nd-field-row">
                  <label class="nd-field-label" for="settings-spellcheck">
                    {{ t('settings.editorSection.spellcheck') }}
                  </label>
                  <label class="nd-switch nd-field-control">
                    <input id="settings-spellcheck" v-model="draft.spellcheck" type="checkbox" />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <div>
                    <label class="nd-field-label" for="settings-autosave">
                      {{ t('settings.editorSection.autosave') }}
                    </label>
                    <p class="nd-field-hint">{{ t('settings.editorSection.autosaveHint') }}</p>
                  </div>
                  <label class="nd-switch nd-field-control">
                    <input id="settings-autosave" v-model="draft.autosave" type="checkbox" />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <div>
                    <span class="nd-field-label">{{ t('settings.editorSection.autosaveDelay') }}</span>
                  </div>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.autosaveDelay"
                      type="range"
                      :min="NUMBER_LIMITS.autosaveDelay.min"
                      :max="NUMBER_LIMITS.autosaveDelay.max"
                      :step="NUMBER_LIMITS.autosaveDelay.step"
                      :disabled="!draft.autosave"
                      :aria-label="t('settings.editorSection.autosaveDelay')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.autosaveDelay"
                      :min="NUMBER_LIMITS.autosaveDelay.min"
                      :max="NUMBER_LIMITS.autosaveDelay.max"
                      :step="NUMBER_LIMITS.autosaveDelay.step"
                      :disabled="!draft.autosave"
                      :aria-label="t('settings.editorSection.autosaveDelay')"
                      @change="commitNumber('autosaveDelay', $event)"
                    />
                    <span class="settings-slider__unit">ms</span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <label class="nd-field-label" for="settings-focus-mode">
                    {{ t('settings.editorSection.focusMode') }}
                  </label>
                  <label class="nd-switch nd-field-control">
                    <input id="settings-focus-mode" v-model="draft.focusMode" type="checkbox" />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <label class="nd-field-label" for="settings-typewriter-mode">
                    {{ t('settings.editorSection.typewriterMode') }}
                  </label>
                  <label class="nd-switch nd-field-control">
                    <input
                      id="settings-typewriter-mode"
                      v-model="draft.typewriterMode"
                      type="checkbox"
                    />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div class="nd-field-row">
                  <label class="nd-field-label" for="settings-word-count">
                    {{ t('settings.editorSection.showWordCount') }}
                  </label>
                  <label class="nd-switch nd-field-control">
                    <input id="settings-word-count" v-model="draft.showWordCount" type="checkbox" />
                    <span class="nd-switch-track" />
                  </label>
                </div>
              </section>

              <section v-else-if="section === 'files'" class="settings-section">
                <div class="nd-field">
                  <span class="nd-field-label">{{ t('settings.filesSection.imageStorage') }}</span>
                  <p class="nd-field-hint">{{ t('settings.filesSection.imageStorageHint') }}</p>
                  <div class="storage-modes">
                    <button
                      v-for="mode in IMAGE_MODES"
                      :key="mode.id"
                      type="button"
                      class="storage-mode"
                      :class="{ 'is-active': draft.imageStorage === mode.id }"
                      @click="chooseImageMode(mode.id)"
                    >
                      <span class="storage-mode__head">
                        <span class="storage-mode__label">{{ t(mode.label) }}</span>
                        <span v-if="mode.id === 'document-assets'" class="nd-badge">
                          {{ t('common.recommended') }}
                        </span>
                        <span v-else-if="mode.id === 'base64'" class="nd-badge">
                          {{ t('common.notRecommended') }}
                        </span>
                      </span>
                      <span class="storage-mode__hint">
                        {{ t(`settings.filesSection.modeHints.${mode.id}`) }}
                      </span>
                    </button>
                  </div>
                  <p v-if="draft.imageStorage === 'base64'" class="settings-warning">
                    {{ t('settings.filesSection.base64Warning') }}
                  </p>
                </div>

                <div v-if="draft.imageStorage === 'document-assets'" class="nd-field">
                  <label class="nd-field-label" for="settings-assets-dir">
                    {{ t('settings.filesSection.assetsDir') }}
                  </label>
                  <input
                    id="settings-assets-dir"
                    v-model="draft.documentAssetsDir"
                    class="nd-input"
                    type="text"
                    placeholder="assets"
                  />
                </div>

                <div v-if="draft.imageStorage === 'global-attachments'" class="nd-field">
                  <label class="nd-field-label" for="settings-global-dir">
                    {{ t('settings.filesSection.globalDir') }}
                  </label>
                  <input
                    id="settings-global-dir"
                    v-model="draft.globalAttachmentsDir"
                    class="nd-input"
                    type="text"
                    placeholder="attachments"
                  />
                </div>

                <div v-if="draft.imageStorage !== 'base64'" class="nd-field">
                  <label class="nd-field-label" for="settings-image-pattern">
                    {{ t('settings.filesSection.pattern') }}
                  </label>
                  <input
                    id="settings-image-pattern"
                    v-model="draft.imageFileNamePattern"
                    class="nd-input"
                    type="text"
                    spellcheck="false"
                  />
                  <p class="nd-field-hint">{{ t('settings.filesSection.patternHint') }}</p>
                  <p class="settings-example">
                    {{ t('settings.filesSection.patternPreview') }}:
                    <code>{{ patternPreview }}</code>
                  </p>
                </div>

                <div class="nd-field">
                  <label class="nd-field-label" for="settings-extension">
                    {{ t('settings.filesSection.defaultExtension') }}
                  </label>
                  <select
                    id="settings-extension"
                    class="nd-select"
                    :value="draft.defaultFileExtension"
                    @change="setExtension"
                  >
                    <option value="md">.md</option>
                    <option value="markdown">.markdown</option>
                  </select>
                </div>
              </section>

              <section v-else-if="section === 'history'" class="settings-section">
                <div class="nd-field-row">
                  <div>
                    <label class="nd-field-label" for="settings-history-enabled">
                      {{ t('settings.historySection.enable') }}
                    </label>
                    <p class="nd-field-hint">{{ t('settings.historySection.enableHint') }}</p>
                  </div>
                  <label class="nd-switch nd-field-control">
                    <input
                      id="settings-history-enabled"
                      v-model="draft.historyEnabled"
                      type="checkbox"
                    />
                    <span class="nd-switch-track" />
                  </label>
                </div>

                <div v-if="historyDirPath" class="nd-field-row settings-history-dir">
                  <div class="settings-history-dir__value">
                    <span class="nd-field-label">{{ t('settings.historySection.location') }}</span>
                    <p class="nd-field-hint">{{ historyDirPath }}</p>
                  </div>
                  <button type="button" class="nd-btn nd-btn--sm" @click="openHistoryDir">
                    <FolderOpen :size="13" />
                    {{ t('settings.historySection.openFolder') }}
                  </button>
                </div>

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.interval') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyIntervalMinutes"
                      type="range"
                      :min="NUMBER_LIMITS.historyIntervalMinutes.min"
                      :max="NUMBER_LIMITS.historyIntervalMinutes.max"
                      :step="NUMBER_LIMITS.historyIntervalMinutes.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.interval')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.historyIntervalMinutes"
                      :min="NUMBER_LIMITS.historyIntervalMinutes.min"
                      :max="NUMBER_LIMITS.historyIntervalMinutes.max"
                      :step="NUMBER_LIMITS.historyIntervalMinutes.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.interval')"
                      @change="commitNumber('historyIntervalMinutes', $event)"
                    />
                    <span class="settings-slider__unit">
                      {{ t('settings.historySection.minutesUnit') }}
                    </span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.maxVersions') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyMaxPerFile"
                      type="range"
                      :min="NUMBER_LIMITS.historyMaxPerFile.min"
                      :max="NUMBER_LIMITS.historyMaxPerFile.max"
                      :step="NUMBER_LIMITS.historyMaxPerFile.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.maxVersions')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.historyMaxPerFile"
                      :min="NUMBER_LIMITS.historyMaxPerFile.min"
                      :max="NUMBER_LIMITS.historyMaxPerFile.max"
                      :step="NUMBER_LIMITS.historyMaxPerFile.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.maxVersions')"
                      @change="commitNumber('historyMaxPerFile', $event)"
                    />
                  </div>
                </div>

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.retention') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyRetentionDays"
                      type="range"
                      :min="NUMBER_LIMITS.historyRetentionDays.min"
                      :max="NUMBER_LIMITS.historyRetentionDays.max"
                      :step="NUMBER_LIMITS.historyRetentionDays.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.retention')"
                    />
                    <input
                      class="nd-input settings-slider__number"
                      type="number"
                      :value="draft.historyRetentionDays"
                      :min="NUMBER_LIMITS.historyRetentionDays.min"
                      :max="NUMBER_LIMITS.historyRetentionDays.max"
                      :step="NUMBER_LIMITS.historyRetentionDays.step"
                      :disabled="!draft.historyEnabled"
                      :aria-label="t('settings.historySection.retention')"
                      @change="commitNumber('historyRetentionDays', $event)"
                    />
                    <span class="settings-slider__unit">
                      {{ t('settings.historySection.daysUnit') }}
                    </span>
                  </div>
                </div>

                <div class="settings-inline-actions settings-inline-actions--start">
                  <button
                    type="button"
                    class="nd-btn nd-btn--danger"
                    :disabled="!platform.capabilities.localHistory"
                    @click="clearHistory"
                  >
                    <Trash2 :size="13" />
                    {{ t('settings.historySection.clear') }}
                  </button>
                </div>
              </section>

              <section v-else-if="section === 'shortcuts'" class="settings-section">
                <ShortcutsList />
              </section>

              <section v-else-if="section === 'updates'" class="settings-section">
                <div class="nd-field-row">
                  <div>
                    <span class="nd-field-label">{{ t('settings.updatesSection.manualCheck') }}</span>
                    <p class="nd-field-hint">{{ t('settings.updatesSection.manualCheckHint') }}</p>
                  </div>
                  <button type="button" class="nd-btn nd-btn--sm" @click="update.check()">
                    <RefreshCw :size="13" />
                    {{ t('menu.checkForUpdates') }}
                  </button>
                </div>

                <div class="nd-field-row">
                  <div>
                    <label class="nd-field-label" for="settings-auto-check-updates">
                      {{ t('settings.autoCheckUpdates') }}
                    </label>
                    <p class="nd-field-hint">{{ t('settings.autoCheckUpdatesHint') }}</p>
                  </div>
                  <label class="nd-switch nd-field-control">
                    <input
                      id="settings-auto-check-updates"
                      v-model="draft.autoCheckUpdates"
                      type="checkbox"
                    />
                    <span class="nd-switch-track" />
                  </label>
                </div>
              </section>

              <section v-else class="settings-section settings-about">
                <div class="settings-about__head">
                  <BrandMark :size="40" />
                  <div>
                    <div class="settings-about__name">NotaDown</div>
                    <p class="settings-about__description">
                      {{ t('settings.aboutSection.description') }}
                    </p>
                  </div>
                </div>
                <dl class="settings-about__meta">
                  <div>
                    <dt>{{ t('settings.aboutSection.version') }}</dt>
                    <dd>{{ platform.version }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('settings.aboutSection.license') }}</dt>
                    <dd>MIT</dd>
                  </div>
                  <div>
                    <dt>{{ t('settings.aboutSection.platform') }}</dt>
                    <dd>{{ platform.kind === 'desktop' ? t('status.desktop') : t('status.web') }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('settings.aboutSection.repository') }}</dt>
                    <dd>
                      <a
                        class="settings-about__link"
                        :href="REPOSITORY_URL"
                        target="_blank"
                        rel="noopener noreferrer"
                        @click.prevent="openRepository"
                      >
                        {{ REPOSITORY_URL }}
                        <ExternalLink :size="12" />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{{ t('settings.aboutSection.builtWith') }}</dt>
                    <dd>Milkdown · Vue · Electron</dd>
                  </div>
                </dl>
                <div v-if="isDesktop" class="settings-about__actions">
                  <button type="button" class="nd-btn nd-btn--sm" @click="update.check()">
                    <RefreshCw :size="13" />
                    {{ t('menu.checkForUpdates') }}
                  </button>
                </div>
              </section>
            </div>
          </div>

          <footer class="settings-dialog__footer">
            <button type="button" class="nd-btn nd-btn--ghost nd-btn--sm" @click="resetSettings">
              <RotateCcw :size="13" />
              {{ t('settings.reset') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-dialog {
  width: min(900px, 96vw);
  height: min(680px, 88vh);
}

.settings-dialog__layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.settings-nav {
  display: flex;
  flex: 0 0 172px;
  flex-direction: column;
  gap: 1px;
  padding: 10px;
  border-right: 1px solid var(--nd-border);
  background: color-mix(in srgb, var(--nd-surface) 45%, transparent);
}

.settings-nav__item {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  text-align: left;
}

.settings-nav__item:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.settings-nav__item.is-active {
  background: var(--nd-surface-hover);
  color: var(--nd-accent);
  font-weight: 550;
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: 20px 24px 40px;
  overflow-y: auto;
}

.settings-section {
  max-width: 620px;
}

.segmented {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-surface);
}

.segmented__item {
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 12px;
}

.segmented__item:hover {
  color: var(--nd-text);
}

.segmented__item.is-active {
  background: var(--nd-bg-elevated);
  color: var(--nd-text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg-elevated);
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.theme-card:hover {
  border-color: var(--nd-border-strong);
}

.theme-card.is-active {
  border-color: var(--nd-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--nd-accent) 20%, transparent);
  color: var(--nd-text);
}

.theme-card__swatch {
  display: flex;
  height: 26px;
  overflow: hidden;
  border: 1px solid var(--nd-border);
  border-radius: 5px;
}

.theme-card__color {
  flex: 1;
}

.theme-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 280px;
}

.nd-field-row .nd-switch.nd-field-control {
  justify-content: flex-end;
}

.settings-slider input[type='range'] {
  flex: 1;
  min-width: 90px;
  accent-color: var(--nd-accent);
}

.settings-slider__number {
  flex: 0 0 72px;
  width: 72px;
  height: 28px;
  padding: 0 7px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  appearance: textfield;
}

.settings-slider__number::-webkit-outer-spin-button,
.settings-slider__number::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.settings-slider__unit {
  flex: 0 0 auto;
  min-width: 16px;
  color: var(--nd-text-muted);
  font-size: 11.5px;
}

.settings-preview {
  padding: 16px 18px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg);
  color: var(--nd-text);
  font-family: var(--nd-font-editor);
}

.settings-css {
  margin-top: 8px;
  min-height: 130px;
  font-family: var(--nd-font-mono);
  font-size: 12px;
}

.settings-file-input {
  display: none;
}

.settings-recreate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-surface);
}

.settings-recreate__notice {
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  line-height: 1.5;
}

.settings-inline-actions {
  display: flex;
  gap: 7px;
  margin-top: 10px;
}

.settings-inline-actions--start {
  justify-content: flex-start;
  margin-top: 20px;
}

.settings-history-dir__value {
  min-width: 0;
}

.settings-history-dir .nd-field-hint {
  word-break: break-all;
}

.storage-modes {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.storage-mode {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 11px 13px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg-elevated);
  color: var(--nd-text-secondary);
  text-align: left;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.storage-mode:hover {
  border-color: var(--nd-border-strong);
}

.storage-mode.is-active {
  border-color: var(--nd-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--nd-accent) 16%, transparent);
}

.storage-mode__head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--nd-text);
  font-size: 12.5px;
  font-weight: 550;
}

.storage-mode__hint {
  color: var(--nd-text-muted);
  font-size: 11.5px;
  line-height: 1.5;
}

.settings-warning {
  margin: 9px 0 0;
  color: var(--nd-warning);
  font-size: 11.5px;
  line-height: 1.5;
}

.settings-example {
  margin: 0;
  color: var(--nd-text-muted);
  font-size: 11.5px;
}

.settings-example code {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--nd-surface);
  font-family: var(--nd-font-mono);
  font-size: 11px;
}

.settings-about__head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--nd-border);
}

.settings-about__name {
  font-family: var(--nd-font-display);
  font-size: 20px;
  font-weight: 650;
}

.settings-about__description {
  margin: 4px 0 0;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.settings-about__meta {
  margin: 8px 0 0;
}

.settings-about__meta > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 11px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--nd-border) 60%, transparent);
  font-size: 12.5px;
}

.settings-about__meta dt {
  color: var(--nd-text-secondary);
}

.settings-about__meta dd {
  margin: 0;
  color: var(--nd-text);
  text-align: right;
}

.settings-about__link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--nd-accent);
  text-decoration: none;
}

.settings-about__link:hover {
  text-decoration: underline;
}

.settings-about__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 18px;
}

.settings-dialog__footer {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-start;
  padding: 10px 14px;
  border-top: 1px solid var(--nd-border);
}

@media (max-width: 760px) {
  .settings-nav {
    flex-basis: 46px;
    padding: 8px 5px;
  }

  .settings-nav__item {
    justify-content: center;
    padding: 0;
    font-size: 0;
  }

  .theme-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-content {
    padding: 16px;
  }
}
</style>
