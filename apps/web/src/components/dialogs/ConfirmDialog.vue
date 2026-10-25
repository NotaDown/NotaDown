<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const confirmRef = ref<HTMLButtonElement | null>(null)

watch(
  () => ui.confirmState?.id,
  async (id) => {
    if (!id) return
    await nextTick()
    confirmRef.value?.focus()
  },
)

function close(value: boolean): void {
  ui.resolveConfirm(value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="ui.confirmState"
        class="nd-overlay nd-overlay--center nd-overlay--confirm"
        @click.self="close(false)"
      >
        <div class="nd-dialog confirm-dialog" role="alertdialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ ui.confirmState.title }}</h2>
          </header>
          <div v-if="ui.confirmState.message" class="nd-dialog-body confirm-dialog__body">
            {{ ui.confirmState.message }}
          </div>
          <footer class="nd-dialog-footer">
            <button type="button" class="nd-btn" @click="close(false)">
              {{ ui.confirmState.cancelLabel ?? t('common.cancel') }}
            </button>
            <button
              ref="confirmRef"
              type="button"
              class="nd-btn"
              :class="ui.confirmState.danger ? 'nd-btn--danger' : 'nd-btn--primary'"
              @click="close(true)"
            >
              {{ ui.confirmState.confirmLabel ?? t('common.ok') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Above other overlays (100) and popup menus (220), below toasts (300). */
.nd-overlay--confirm {
  z-index: 250;
}

.confirm-dialog {
  width: min(420px, 100%);
}

.confirm-dialog__body {
  flex: none;
  padding: 16px 18px;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}
</style>
