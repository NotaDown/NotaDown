<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Image,
  Info,
  Keyboard,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Type,
  History,
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
  type ThemeId,
} from '@notadown/shared'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@notadown/i18n'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore, type SettingsSection } from '@/stores/ui'
import ShortcutsList from '../common/ShortcutsList.vue'
import BrandMark from '../common/BrandMark.vue'

const { t } = useI18n()
const settings = useSettingsStore()
const ui = useUiStore()

const draft = reactive<AppSettings>({ ...settings.settings })
const section = ref<SettingsSection>(ui.settingsSection)
const cssInput = ref<HTMLInputElement | null>(null)

const SECTIONS: Array<{ id: SettingsSection; icon: typeof Info; label: string }> = [
  { id: 'general', icon: SlidersHorizontal, label: 'settings.general' },
  { id: 'appearance', icon: Palette, label: 'settings.appearance' },
  { id: 'editor', icon: Type, label: 'settings.editor' },
  { id: 'files', icon: Image, label: 'settings.files' },
  { id: 'history', icon: History, label: 'settings.history' },
  { id: 'shortcuts', icon: Keyboard, label: 'settings.shortcuts' },
  { id: 'about', icon: Info, label: 'settings.about' },
]

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

function chooseTheme(id: ThemeId): void {
  draft.theme = id
}

function chooseColorMode(id: ColorMode): void {
  draft.colorMode = id
}

function chooseImageMode(id: ImageStorageMode): void {
  draft.imageStorage = id
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
                    <input v-model.number="draft.fontSize" type="range" min="12" max="32" step="1" />
                    <span class="settings-slider__value">{{ draft.fontSize }}px</span>
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
                      min="1.2"
                      max="2.6"
                      step="0.05"
                    />
                    <span class="settings-slider__value">{{ draft.lineHeight.toFixed(2) }}</span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <div>
                    <span class="nd-field-label">{{ t('settings.appearanceSection.editorWidth') }}</span>
                  </div>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.editorWidth"
                      type="range"
                      min="480"
                      max="1400"
                      step="20"
                    />
                    <span class="settings-slider__value">{{ draft.editorWidth }}px</span>
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
                      maxWidth: `${Math.min(draft.editorWidth, 640)}px`,
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
                      min="200"
                      max="5000"
                      step="100"
                      :disabled="!draft.autosave"
                    />
                    <span class="settings-slider__value">{{ draft.autosaveDelay }}ms</span>
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

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.interval') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyIntervalMinutes"
                      type="range"
                      min="1"
                      max="60"
                      step="1"
                      :disabled="!draft.historyEnabled"
                    />
                    <span class="settings-slider__value">
                      {{ t('settings.historySection.minutes', { count: draft.historyIntervalMinutes }) }}
                    </span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.maxVersions') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyMaxPerFile"
                      type="range"
                      min="5"
                      max="500"
                      step="5"
                      :disabled="!draft.historyEnabled"
                    />
                    <span class="settings-slider__value">{{ draft.historyMaxPerFile }}</span>
                  </div>
                </div>

                <div class="nd-field-row">
                  <span class="nd-field-label">{{ t('settings.historySection.retention') }}</span>
                  <div class="settings-slider nd-field-control">
                    <input
                      v-model.number="draft.historyRetentionDays"
                      type="range"
                      min="1"
                      max="365"
                      step="1"
                      :disabled="!draft.historyEnabled"
                    />
                    <span class="settings-slider__value">
                      {{ t('settings.historySection.days', { count: draft.historyRetentionDays }) }}
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
                    <dt>{{ t('settings.aboutSection.builtWith') }}</dt>
                    <dd>Milkdown · Vue · Electron</dd>
                  </div>
                </dl>
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
}

.settings-slider input[type='range'] {
  flex: 1;
  min-width: 90px;
  accent-color: var(--nd-accent);
}

.settings-slider__value {
  flex: 0 0 auto;
  min-width: 62px;
  color: var(--nd-text-muted);
  font-size: 11.5px;
  text-align: right;
  font-variant-numeric: tabular-nums;
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

.settings-inline-actions {
  display: flex;
  gap: 7px;
  margin-top: 10px;
}

.settings-inline-actions--start {
  justify-content: flex-start;
  margin-top: 20px;
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
