<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import ShortcutsList from '../common/ShortcutsList.vue'

const { t } = useI18n()
const ui = useUiStore()

const filter = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => ui.shortcutsOpen,
  async (open) => {
    if (!open) return
    filter.value = ''
    await nextTick()
    inputRef.value?.focus()
  },
)

function close(): void {
  ui.shortcutsOpen = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div v-if="ui.shortcutsOpen" class="nd-overlay" @click.self="close">
        <div class="nd-dialog shortcuts-dialog" role="dialog" aria-modal="true">
          <header class="nd-dialog-header">
            <h2 class="nd-dialog-title">{{ t('shortcuts.title') }}</h2>
            <button type="button" class="nd-icon-btn" :title="t('common.close')" @click="close">
              <X :size="16" />
            </button>
          </header>
          <div class="shortcuts-dialog__search">
            <Search :size="14" class="shortcuts-dialog__search-icon" />
            <input
              ref="inputRef"
              v-model="filter"
              type="text"
              class="nd-input shortcuts-dialog__input"
              :placeholder="t('shortcuts.searchPlaceholder')"
            />
          </div>
          <div class="nd-dialog-body nd-scroll">
            <ShortcutsList :filter="filter" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.shortcuts-dialog {
  width: min(620px, 100%);
  height: min(720px, 82vh);
}

.shortcuts-dialog__search {
  position: relative;
  flex: 0 0 auto;
  padding: 12px 18px;
  border-bottom: 1px solid var(--nd-border);
}

.shortcuts-dialog__search-icon {
  position: absolute;
  top: 50%;
  left: 30px;
  color: var(--nd-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.shortcuts-dialog__input {
  padding-left: 30px;
}
</style>
