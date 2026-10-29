<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  X,
} from '@lucide/vue'
import type { ToastMessage } from '@notadown/shared'
import { useUiStore } from '@/stores/ui'
import UpdateNotice from './UpdateNotice.vue'

const { t } = useI18n()
const ui = useUiStore()

function iconFor(type: ToastMessage['type']) {
  if (type === 'success') return CircleCheck
  if (type === 'error') return CircleX
  if (type === 'warning') return TriangleAlert
  return Info
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <UpdateNotice />
      <TransitionGroup name="toast">
        <div
          v-for="toast in ui.toasts"
          :key="toast.id"
          class="toast"
          :class="`is-${toast.type}`"
        >
          <component :is="iconFor(toast.type)" :size="15" class="toast__icon" />
          <div class="toast__text">
            <div class="toast__message">{{ toast.message }}</div>
            <div v-if="toast.detail" class="toast__detail">{{ toast.detail }}</div>
          </div>
          <button
            type="button"
            class="toast__close"
            :title="t('common.close')"
            @click="ui.dismissToast(toast.id)"
          >
            <X :size="13" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  z-index: 300;
  right: 16px;
  bottom: calc(var(--nd-statusbar-height) + 14px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.toast {
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

.toast__icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--nd-text-muted);
}

.toast.is-success .toast__icon {
  color: var(--nd-success);
}

.toast.is-warning .toast__icon {
  color: var(--nd-warning);
}

.toast.is-error .toast__icon {
  color: var(--nd-danger);
}

.toast__text {
  flex: 1;
  min-width: 0;
}

.toast__message {
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.4;
}

.toast__detail {
  margin-top: 3px;
  color: var(--nd-text-muted);
  font-size: 11.5px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.toast__close {
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

.toast__close:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
