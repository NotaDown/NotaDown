<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore, type UnsavedChoice } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const saveRef = ref<HTMLButtonElement | null>(null)

watch(
  () => ui.unsavedState?.id,
  async (id) => {
    if (!id) return
    await nextTick()
    saveRef.value?.focus()
  },
)

function choose(choice: UnsavedChoice): void {
  ui.resolveUnsaved(choice)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="ui.unsavedState"
        class="nd-overlay nd-overlay--center"
        @click.self="choose('cancel')"
      >
        <div class="nd-dialog unsaved-dialog" role="alertdialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">
              {{ t('dialogs.unsavedTitle', { name: ui.unsavedState.name }) }}
            </h2>
          </header>
          <div class="nd-dialog-body unsaved-dialog__body">
            {{ t('dialogs.unsavedMessage') }}
          </div>
          <footer class="nd-dialog-footer">
            <button type="button" class="nd-btn" @click="choose('cancel')">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="nd-btn nd-btn--danger" @click="choose('discard')">
              {{ t('dialogs.closeWithoutSaving') }}
            </button>
            <button
              ref="saveRef"
              type="button"
              class="nd-btn nd-btn--primary"
              @click="choose('save')"
            >
              {{ t('dialogs.saveAndClose') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.unsaved-dialog {
  width: min(460px, 100%);
}

.unsaved-dialog__body {
  flex: none;
  padding: 16px 18px;
  color: var(--nd-text-secondary);
  font-size: 12.5px;
  line-height: 1.6;
}
</style>
