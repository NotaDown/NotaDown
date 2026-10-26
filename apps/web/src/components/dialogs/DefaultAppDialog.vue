<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { platform } from '@/platform'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const primaryRef = ref<HTMLButtonElement | null>(null)

watch(
  () => ui.defaultAppOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    primaryRef.value?.focus()
  },
)

async function openSettings(): Promise<void> {
  ui.defaultAppOpen = false
  try {
    await platform.openDefaultAppSettings()
  } catch {
    ui.toast('error', t('defaultApp.openFailed'))
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="ui.defaultAppOpen"
        class="nd-overlay nd-overlay--center nd-overlay--confirm"
        @click.self="ui.defaultAppOpen = false"
      >
        <div class="nd-dialog default-app-dialog" role="dialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ t('defaultApp.title') }}</h2>
          </header>

          <div class="nd-dialog-body default-app-dialog__body">
            <p>{{ t('defaultApp.body') }}</p>
            <p class="default-app-dialog__steps">{{ t('defaultApp.steps') }}</p>
          </div>

          <footer class="nd-dialog-footer">
            <button type="button" class="nd-btn" @click="ui.defaultAppOpen = false">
              {{ t('defaultApp.notNow') }}
            </button>
            <button
              ref="primaryRef"
              type="button"
              class="nd-btn nd-btn--primary"
              @click="openSettings"
            >
              {{ t('defaultApp.openSettings') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Shares the confirm overlay layer: it is a one-off blocking prompt. */
.default-app-dialog {
  width: min(460px, 100%);
}

.default-app-dialog__body {
  flex: none;
  padding: 16px 18px;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}

.default-app-dialog__body p + p {
  margin-top: 10px;
}

.default-app-dialog__steps {
  color: var(--nd-text-muted);
}
</style>
