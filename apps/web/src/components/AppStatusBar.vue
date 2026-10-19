<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlignVerticalJustifyCenter,
  Code,
  Focus,
  LoaderCircle,
  TriangleAlert,
  Type,
} from 'lucide-vue-next'
import { countWords } from '@notadown/shared'
import { formatNumber } from '@notadown/i18n'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'

const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()

const active = computed(() => tabs.activeTab)
const counts = ref({ words: 0, characters: 0 })
let countTimer: number | null = null

watch(
  () => active.value?.content ?? '',
  (content) => {
    if (countTimer !== null) window.clearTimeout(countTimer)
    countTimer = window.setTimeout(() => {
      countTimer = null
      counts.value = countWords(content)
    }, 300)
  },
  { immediate: true },
)

onScopeDispose(() => {
  if (countTimer !== null) window.clearTimeout(countTimer)
})

const saveState = computed(() => {
  const tab = active.value
  if (!tab) return null
  if (tab.saving) return 'saving' as const
  if (tab.conflict) return 'conflict' as const
  if (tab.missing) return 'missing' as const
  if (tabs.isDirty(tab)) {
    return settings.settings.autosave ? ('unsaved' as const) : ('manual' as const)
  }
  return 'saved' as const
})

const saveLabel = computed(() => {
  switch (saveState.value) {
    case 'saving':
      return t('status.saving')
    case 'conflict':
      return t('tabs.conflict')
    case 'missing':
      return t('tabs.missing')
    case 'unsaved':
      return t('status.unsaved')
    case 'manual':
      return t('status.autosaveOff')
    case 'saved':
      return t('status.saved')
    default:
      return ''
  }
})

const isSource = computed(() => active.value?.viewMode === 'source')

function toggleViewMode(): void {
  const tab = active.value
  if (!tab) return
  tabs.toggleViewMode(tab.key)
}

function toggleFocusMode(): void {
  settings.update({ focusMode: !settings.settings.focusMode })
}

function toggleTypewriterMode(): void {
  settings.update({ typewriterMode: !settings.settings.typewriterMode })
}
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar__side">
      <span v-if="active" class="status-bar__save" :class="`is-${saveState}`">
        <LoaderCircle v-if="saveState === 'saving'" :size="12" class="status-bar__spin" />
        <TriangleAlert
          v-else-if="saveState === 'conflict' || saveState === 'missing'"
          :size="12"
        />
        <span v-else class="status-bar__dot" />
        {{ saveLabel }}
      </span>
    </div>

    <div class="status-bar__side status-bar__side--end">
      <span v-if="active && settings.settings.showWordCount" class="status-bar__counts">
        {{ t('status.words', { count: formatNumber(counts.words, settings.locale) }) }}
        <span class="status-bar__separator">·</span>
        {{ t('status.characters', { count: formatNumber(counts.characters, settings.locale) }) }}
      </span>

      <button
        v-if="active"
        type="button"
        class="status-bar__button"
        :class="{ 'is-active': isSource }"
        :title="isSource ? t('editor.richMode') : t('editor.sourceMode')"
        @click="toggleViewMode"
      >
        <Code v-if="isSource" :size="13" />
        <Type v-else :size="13" />
        {{ isSource ? t('editor.sourceMode') : t('editor.richMode') }}
      </button>

      <button
        type="button"
        class="status-bar__button"
        :class="{ 'is-active': settings.settings.focusMode }"
        :title="t('editor.focusMode')"
        :aria-pressed="settings.settings.focusMode"
        @click="toggleFocusMode"
      >
        <Focus :size="13" />
      </button>

      <button
        type="button"
        class="status-bar__button"
        :class="{ 'is-active': settings.settings.typewriterMode }"
        :title="t('editor.typewriterMode')"
        :aria-pressed="settings.settings.typewriterMode"
        @click="toggleTypewriterMode"
      >
        <AlignVerticalJustifyCenter :size="13" />
      </button>

      <span class="status-bar__platform">
        {{ platform.kind === 'desktop' ? t('status.desktop') : t('status.web') }}
      </span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  height: var(--nd-statusbar-height);
  padding: 0 8px;
  border-top: 1px solid var(--nd-border);
  background: var(--nd-bg-elevated);
  color: var(--nd-text-muted);
  font-size: 11px;
  user-select: none;
}

.status-bar__side {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.status-bar__side--end {
  margin-left: auto;
}

.status-bar__save {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 5px;
  height: 20px;
  border-radius: 4px;
  white-space: nowrap;
}

.status-bar__save.is-conflict,
.status-bar__save.is-missing {
  color: var(--nd-warning);
}

.status-bar__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.status-bar__save.is-unsaved .status-bar__dot,
.status-bar__save.is-manual .status-bar__dot {
  background: var(--nd-accent);
  opacity: 1;
}

.status-bar__spin {
  animation: nd-spin 0.9s linear infinite;
}

.status-bar__counts {
  padding: 0 7px;
  white-space: nowrap;
}

.status-bar__separator {
  padding: 0 2px;
  opacity: 0.5;
}

.status-bar__button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nd-text-muted);
  font-size: 11px;
  transition: background 0.12s ease, color 0.12s ease;
}

.status-bar__button:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.status-bar__button.is-active {
  color: var(--nd-accent);
}

.status-bar__platform {
  padding: 0 5px 0 8px;
  opacity: 0.75;
}

@media (max-width: 720px) {
  .status-bar__counts {
    display: none;
  }
}
</style>
