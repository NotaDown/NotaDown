<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpCircle, X } from '@lucide/vue'
import { useUpdateStore } from '@/stores/update'

const { t } = useI18n()
const update = useUpdateStore()

const version = computed(() => update.snapshot?.version ?? '')
</script>

<template>
  <Transition name="update-notice">
    <div v-if="update.noticeVisible && version" class="update-notice">
      <ArrowUpCircle :size="15" class="update-notice__icon" />
      <div class="update-notice__text">
        <div class="update-notice__title">
          {{ t('update.noticeTitle', { version }) }}
        </div>
        <div class="update-notice__body">{{ t('update.noticeBody') }}</div>
        <div class="update-notice__actions">
          <button
            type="button"
            class="nd-btn nd-btn--ghost nd-btn--sm"
            @click="update.skipVersion()"
          >
            {{ t('update.skipVersion') }}
          </button>
          <button
            type="button"
            class="nd-btn nd-btn--primary nd-btn--sm"
            @click="update.startUpdate()"
          >
            {{ t('update.update') }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="update-notice__close"
        :title="t('update.close')"
        :aria-label="t('update.close')"
        @click="update.dismissNotice()"
      >
        <X :size="13" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.update-notice {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: min(360px, calc(100vw - 32px));
  padding: 10px 10px 10px 12px;
  border: 1px solid var(--nd-border);
  border-radius: var(--nd-radius-md);
  background: var(--nd-bg-elevated);
  box-shadow: var(--nd-shadow);
  color: var(--nd-text);
  pointer-events: auto;
}

.update-notice__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--nd-accent);
}

.update-notice__text {
  flex: 1;
  min-width: 0;
}

.update-notice__title {
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.4;
}

.update-notice__body {
  margin-top: 3px;
  color: var(--nd-text-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.update-notice__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 9px;
}

.update-notice__close {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--nd-text-muted);
}

.update-notice__close:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.update-notice-enter-active,
.update-notice-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.update-notice-enter-from,
.update-notice-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
