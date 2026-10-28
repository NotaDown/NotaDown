<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'
import { useUpdateStore } from '@/stores/update'

const { t } = useI18n()
const ui = useUiStore()
const update = useUpdateStore()

const status = computed(() => update.snapshot?.status ?? 'idle')
const currentVersion = computed(
  () => update.snapshot?.currentVersion ?? platform.version,
)
const latestVersion = computed(() => update.snapshot?.version ?? null)
const showVersions = computed(
  () => Boolean(latestVersion.value) || status.value === 'not-available',
)
const percent = computed(() => Math.round((update.snapshot?.progress ?? 0) * 100))
const transfer = computed(() => {
  const snapshot = update.snapshot
  if (!snapshot || snapshot.transferred == null || snapshot.total == null) return ''
  const speed =
    snapshot.bytesPerSecond == null ? '' : ` · ${formatBytes(snapshot.bytesPerSecond)}/s`
  return `${formatBytes(snapshot.transferred)} / ${formatBytes(snapshot.total)}${speed}`
})

const sourceLabel = computed(() => {
  const snapshot = update.snapshot
  if (!snapshot?.metadataSource) return ''
  if (snapshot.metadataSource === 'github') return 'GitHub'
  return snapshot.metadataUrl ?? 'NotaDown'
})

const downloadLabel = computed(() => update.snapshot?.downloadUrl ?? '')

interface NoteLine {
  kind: 'heading' | 'item' | 'text'
  text: string
}

const noteLines = computed<NoteLine[]>(() => {
  const raw = update.snapshot?.releaseNotes
  if (!raw) return []
  const clean = (value: string) =>
    value
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim()
  return raw
    .split(/\r?\n/)
    .map((line): NoteLine | null => {
      const trimmed = line.trim()
      if (!trimmed) return null
      if (trimmed.startsWith('### ')) {
        return { kind: 'heading', text: clean(trimmed.slice(4)) }
      }
      if (trimmed.startsWith('## ')) {
        return { kind: 'heading', text: clean(trimmed.slice(3)) }
      }
      if (trimmed.startsWith('- ')) {
        return { kind: 'item', text: clean(trimmed.slice(2)) }
      }
      return { kind: 'text', text: clean(trimmed) }
    })
    .filter((line): line is NoteLine => line !== null)
})

const message = computed(() => {
  switch (status.value) {
    case 'checking':
      return t('update.checking')
    case 'not-available':
      return t('update.upToDate')
    case 'available':
      return t('update.available')
    case 'downloading':
      return t('update.downloading')
    case 'downloaded':
      return update.installBlocked ? t('update.installBlocked') : t('update.downloaded')
    case 'error':
      return latestVersion.value ? t('update.downloadFailed') : t('update.checkFailed')
    case 'unsupported':
      return update.snapshot?.reason === 'development'
        ? t('update.development')
        : t('update.unsupported')
    default:
      return ''
  }
})

function close(): void {
  ui.updateOpen = false
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`
}

</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="ui.updateOpen"
        class="nd-overlay nd-overlay--center update-overlay"
        @click.self="close"
      >
        <div class="nd-dialog update-dialog" role="dialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ t('update.title') }}</h2>
            <button
              type="button"
              class="nd-icon-btn"
              :aria-label="t('update.close')"
              @click="close"
            >
              <X :size="16" />
            </button>
          </header>

          <div class="nd-dialog-body update-dialog__body">
            <div v-if="showVersions" class="update-versions">
              <div>
                <span class="update-versions__label">{{ t('update.currentVersion') }}</span>
                <strong class="update-versions__value">{{ currentVersion }}</strong>
              </div>
              <div v-if="latestVersion">
                <span class="update-versions__label">{{ t('update.latestVersion') }}</span>
                <strong class="update-versions__value">{{ latestVersion }}</strong>
              </div>
            </div>

            <div
              class="update-status"
              :class="{
                'update-status--error': status === 'error',
                'update-status--busy':
                  status === 'checking' || status === 'downloading',
              }"
              aria-live="polite"
            >
              <span
                v-if="status === 'checking' || status === 'downloading' || update.installing"
                class="nd-spinner"
              />
              <p>{{ message }}</p>
            </div>

            <p v-if="status === 'error' && update.snapshot?.error" class="update-error-detail">
              {{ update.snapshot.error }}
            </p>

            <p v-if="sourceLabel" class="update-source">
              <span>{{ t('update.metadataSource', { source: sourceLabel }) }}</span>
              <template v-if="downloadLabel">
                <span class="update-source__sep">·</span>
                <span>{{ t('update.downloadAddress', { url: downloadLabel }) }}</span>
              </template>
            </p>

            <div v-if="status === 'downloading'" class="update-progress">
              <div class="update-progress__bar">
                <span :style="{ width: `${percent}%` }" />
              </div>
              <div class="update-progress__meta">
                <span>{{ percent }}%</span>
                <span v-if="transfer">{{ transfer }}</span>
              </div>
            </div>

            <section v-if="latestVersion && noteLines.length" class="update-notes">
              <h3>{{ t('update.releaseNotes') }}</h3>
              <div class="update-notes__body">
                <template v-for="(line, index) in noteLines" :key="index">
                  <p v-if="line.kind === 'heading'" class="update-notes__heading">
                    {{ line.text }}
                  </p>
                  <p v-else-if="line.kind === 'item'" class="update-notes__item">
                    {{ line.text }}
                  </p>
                  <p v-else class="update-notes__text">{{ line.text }}</p>
                </template>
              </div>
            </section>
            <p
              v-else-if="latestVersion && status === 'available'"
              class="update-muted"
            >
              {{ t('update.noReleaseNotes') }}
            </p>
          </div>

          <footer class="nd-dialog-footer">
            <template v-if="status === 'available'">
              <button type="button" class="nd-btn" @click="close">
                {{ t('update.later') }}
              </button>
              <button
                type="button"
                class="nd-btn nd-btn--primary"
                @click="update.download()"
              >
                {{ t('update.update') }}
              </button>
            </template>
            <template v-else-if="status === 'downloaded'">
              <button
                v-if="!update.installing"
                type="button"
                class="nd-btn nd-btn--primary"
                @click="update.install()"
              >
                {{ t('update.restartInstall') }}
              </button>
            </template>
            <template v-else-if="status === 'error'">
              <button type="button" class="nd-btn" @click="close">
                {{ t('update.close') }}
              </button>
              <button type="button" class="nd-btn nd-btn--primary" @click="update.check()">
                {{ t('update.retry') }}
              </button>
            </template>
            <template v-else-if="status === 'unsupported'">
              <button type="button" class="nd-btn" @click="close">
                {{ t('update.close') }}
              </button>
              <button
                type="button"
                class="nd-btn nd-btn--primary"
                @click="update.openReleases()"
              >
                {{ t('update.openReleases') }}
              </button>
            </template>
            <template v-else>
              <button type="button" class="nd-btn" @click="close">
                {{ t('update.close') }}
              </button>
            </template>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-overlay {
  z-index: 240;
}

.update-dialog {
  width: min(560px, 100%);
  max-height: min(660px, 86vh);
}

.update-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.update-versions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.update-versions > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-surface);
}

.update-versions__label {
  color: var(--nd-text-muted);
  font-size: 11px;
}

.update-versions__value {
  font-family: var(--nd-font-mono);
  font-size: 13px;
  font-weight: 600;
}

.update-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.update-status p {
  margin: 0;
}

.update-status--busy {
  color: var(--nd-text);
}

.update-status--error {
  color: var(--nd-danger);
}

.update-error-detail {
  margin: -6px 0 0;
  color: var(--nd-text-muted);
  font-family: var(--nd-font-mono);
  font-size: 11px;
  line-height: 1.5;
  word-break: break-word;
}

.update-source {
  margin: -6px 0 0;
  color: var(--nd-text-muted);
  font-family: var(--nd-font-mono);
  font-size: 11px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.update-source__sep {
  margin: 0 6px;
}

.update-progress__bar {
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--nd-surface);
}

.update-progress__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--nd-accent);
  transition: width 0.2s ease;
}

.update-progress__meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  color: var(--nd-text-muted);
  font-size: 11px;
}

.update-notes {
  padding-top: 12px;
  border-top: 1px solid var(--nd-border);
}

.update-notes h3 {
  margin: 0 0 8px;
  color: var(--nd-text-secondary);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.update-notes__body {
  max-height: 240px;
  overflow: auto;
  padding-right: 4px;
}

.update-notes__heading {
  margin: 10px 0 4px;
  color: var(--nd-text);
  font-size: 12px;
  font-weight: 650;
}

.update-notes__heading:first-child {
  margin-top: 0;
}

.update-notes__item,
.update-notes__text {
  position: relative;
  margin: 0 0 4px;
  padding-left: 14px;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.update-notes__item::before {
  content: '';
  position: absolute;
  top: 0.62em;
  left: 3px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--nd-text-muted);
}

.update-notes__text {
  padding-left: 0;
}

.update-muted {
  margin: 0;
  color: var(--nd-text-muted);
  font-size: 12px;
}
</style>
