<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Clock,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  Info,
  X,
} from 'lucide-vue-next'
import { formatRelativeTime } from '@notadown/i18n'
import { platform } from '@/platform'
import {
  useRecentStore,
  type RecentDocument,
  type RecentFolder,
} from '@/stores/recent'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useInjectedCommands } from '@/composables/use-app-commands'
import BrandMark from './common/BrandMark.vue'

const { t } = useI18n()
const recent = useRecentStore()
const settings = useSettingsStore()
const tabs = useTabsStore()
const commands = useInjectedCommands()

const canOpenFolder = platform.capabilities.folderWorkspace
const hasRecent = computed(
  () => recent.documents.length > 0 || recent.folders.length > 0,
)

function run(id: string): void {
  void commands.run(id)
}

function openRecent(entry: RecentDocument): void {
  void tabs.openRecent(entry)
}

function openRecentFolder(entry: RecentFolder): void {
  void tabs.openRecentFolder(entry)
}

function removeRecent(event: MouseEvent, entry: RecentDocument): void {
  event.stopPropagation()
  recent.remove(entry.key)
}

function removeRecentFolder(event: MouseEvent, entry: RecentFolder): void {
  event.stopPropagation()
  recent.removeFolder(entry.key)
}
</script>

<template>
  <div class="welcome nd-scroll">
    <div class="welcome__inner">
      <header class="welcome__header">
        <BrandMark :size="46" />
        <div>
          <h1 class="welcome__title">{{ t('welcome.title') }}</h1>
          <p class="welcome__subtitle">{{ t('welcome.subtitle') }}</p>
        </div>
      </header>

      <div class="welcome__actions">
        <button type="button" class="welcome-action" @click="run('file.new')">
          <span class="welcome-action__icon"><FilePlus :size="19" /></span>
          <span class="welcome-action__text">
            <span class="welcome-action__title">{{ t('welcome.newDocument') }}</span>
            <span class="welcome-action__hint">{{ t('welcome.hintNew') }}</span>
          </span>
        </button>

        <button type="button" class="welcome-action" @click="run('file.open')">
          <span class="welcome-action__icon"><FileText :size="19" /></span>
          <span class="welcome-action__text">
            <span class="welcome-action__title">{{ t('welcome.openFile') }}</span>
            <span class="welcome-action__hint">{{ t('welcome.hintOpen') }}</span>
          </span>
        </button>

        <button
          type="button"
          class="welcome-action"
          :disabled="!canOpenFolder"
          :title="canOpenFolder ? t('welcome.hintFolder') : t('web.folderUnavailable')"
          @click="run('file.openWorkspace')"
        >
          <span class="welcome-action__icon"><FolderOpen :size="19" /></span>
          <span class="welcome-action__text">
            <span class="welcome-action__title">{{ t('welcome.openFolder') }}</span>
            <span class="welcome-action__hint">{{ t('welcome.hintFolder') }}</span>
          </span>
        </button>
      </div>

      <div v-if="!canOpenFolder" class="welcome__note">
        <Info :size="14" />
        <span>{{ t('welcome.webFolderNote') }}</span>
      </div>

      <section class="welcome__recent">
        <div class="welcome__section-head">
          <Clock :size="13" />
          <span>{{ t('welcome.recent') }}</span>
        </div>

        <p v-if="!hasRecent" class="welcome__empty">
          {{ t('welcome.noRecent') }}
        </p>

        <div v-else class="welcome__recent-groups">
          <section class="recent-group">
            <div class="recent-group__head">
              <Folder :size="12" />
              <span>{{ t('welcome.recentFolders') }}</span>
            </div>

            <p
              v-if="recent.folders.length === 0"
              class="welcome__empty welcome__empty--inline"
            >
              {{ t('welcome.noRecentFolders') }}
            </p>

            <ul v-else class="welcome__recent-list">
              <li v-for="entry in recent.folders" :key="entry.key">
                <button type="button" class="recent-row" @click="openRecentFolder(entry)">
                  <Folder :size="14" class="recent-row__icon" />
                  <span class="recent-row__text">
                    <span class="recent-row__name">{{ entry.name }}</span>
                    <span v-if="entry.path" class="recent-row__path">{{ entry.path }}</span>
                  </span>
                  <span class="recent-row__time">
                    {{ formatRelativeTime(entry.openedAt, settings.locale) }}
                  </span>
                  <span
                    class="recent-row__remove"
                    role="button"
                    tabindex="-1"
                    :title="t('common.delete')"
                    @click="removeRecentFolder($event, entry)"
                  >
                    <X :size="12" />
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <section class="recent-group">
            <div class="recent-group__head">
              <FileText :size="12" />
              <span>{{ t('welcome.recentFiles') }}</span>
            </div>

            <p
              v-if="recent.documents.length === 0"
              class="welcome__empty welcome__empty--inline"
            >
              {{ t('welcome.noRecentFiles') }}
            </p>

            <ul v-else class="welcome__recent-list">
              <li v-for="entry in recent.documents" :key="entry.key">
                <button type="button" class="recent-row" @click="openRecent(entry)">
                  <FileText :size="14" class="recent-row__icon" />
                  <span class="recent-row__text">
                    <span class="recent-row__name">{{ entry.name }}</span>
                    <span class="recent-row__path">{{ entry.path }}</span>
                  </span>
                  <span class="recent-row__time">
                    {{ formatRelativeTime(entry.openedAt, settings.locale) }}
                  </span>
                  <span
                    class="recent-row__remove"
                    role="button"
                    tabindex="-1"
                    :title="t('common.delete')"
                    @click="removeRecent($event, entry)"
                  >
                    <X :size="12" />
                  </span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  height: 100%;
  overflow-y: auto;
  background: var(--nd-bg);
}

.welcome__inner {
  display: flex;
  flex-direction: column;
  max-width: 780px;
  margin: 0 auto;
  padding: clamp(48px, 12vh, 120px) 32px 64px;
}

.welcome__header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 36px;
}

.welcome__title {
  margin: 0;
  font-family: var(--nd-font-display);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.1;
}

.welcome__subtitle {
  max-width: 52ch;
  margin: 8px 0 0;
  color: var(--nd-text-secondary);
  font-size: 13.5px;
  line-height: 1.65;
}

.welcome__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.welcome-action {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 14px 15px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-lg);
  background: var(--nd-bg-elevated);
  color: var(--nd-text);
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.welcome-action:hover:not(:disabled) {
  border-color: var(--nd-border-strong);
  background: var(--nd-surface);
  box-shadow: var(--nd-shadow);
}

.welcome-action:disabled {
  opacity: 0.55;
}

.welcome-action__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: var(--nd-radius-md);
  background: color-mix(in srgb, var(--nd-accent) 10%, transparent);
  color: var(--nd-accent);
}

.welcome-action__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.welcome-action__title {
  font-size: 13px;
  font-weight: 600;
}

.welcome-action__hint {
  color: var(--nd-text-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.welcome__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 9px 12px;
  border-radius: var(--nd-radius-md);
  background: var(--nd-surface);
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  line-height: 1.55;
}

.welcome__note svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--nd-text-muted);
}

.welcome__recent {
  margin-top: 40px;
}

.welcome__section-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  color: var(--nd-text-muted);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.welcome__empty {
  margin: 0;
  padding: 18px 2px;
  color: var(--nd-text-muted);
  font-size: 12.5px;
}

.welcome__empty--inline {
  padding: 9px 10px;
  font-size: 12px;
}

.welcome__recent-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 8px 28px;
}

.recent-group__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--nd-text-secondary);
  font-size: 11.5px;
  font-weight: 600;
}

.welcome__recent-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--nd-radius-md);
  background: transparent;
  color: var(--nd-text);
  text-align: left;
  transition: background 0.12s ease;
}

.recent-row:hover {
  background: var(--nd-surface);
}

.recent-row__icon {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
}

.recent-row__text {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.recent-row__name {
  overflow: hidden;
  flex: 0 1 auto;
  font-size: 12.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-row__path {
  overflow: hidden;
  flex: 1;
  color: var(--nd-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-row__time {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
  font-size: 11px;
}

.recent-row__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--nd-text-muted);
  opacity: 0;
  transition: background 0.12s ease, opacity 0.12s ease;
}

.recent-row:hover .recent-row__remove {
  opacity: 1;
}

.recent-row__remove:hover {
  background: var(--nd-surface-hover);
  color: var(--nd-text);
}

@media (max-width: 720px) {
  .welcome__actions {
    grid-template-columns: 1fr;
  }

  .welcome__recent-groups {
    grid-template-columns: 1fr;
    gap: 22px;
  }

  .welcome__inner {
    padding: 40px 20px;
  }
}
</style>
