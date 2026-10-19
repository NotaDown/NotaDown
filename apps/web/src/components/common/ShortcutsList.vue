<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SHORTCUTS,
  shortcutParts,
  type ShortcutCategory,
} from '@notadown/shared'
import { shortcutPlatform } from '@/composables/use-app-commands'

const props = defineProps<{ filter?: string }>()

const { t } = useI18n()
const platform = shortcutPlatform()

const CATEGORY_ORDER: ShortcutCategory[] = [
  'file',
  'edit',
  'format',
  'view',
  'navigation',
  'help',
]

const groups = computed(() => {
  const query = (props.filter ?? '').trim().toLowerCase()
  return CATEGORY_ORDER.map((category) => {
    const items = SHORTCUTS.filter((shortcut) => {
      if (shortcut.category !== category) return false
      if (!query) return true
      const label = t(`shortcuts.actions.${shortcut.id}`).toLowerCase()
      const keys = shortcutParts(shortcut.id, platform).join(' ').toLowerCase()
      return label.includes(query) || keys.includes(query)
    })
    return { category, items }
  }).filter((group) => group.items.length > 0)
})

const hasResults = computed(() => groups.value.length > 0)
</script>

<template>
  <div class="shortcuts-list">
    <div v-if="!hasResults" class="nd-empty">
      <p class="nd-empty-text">{{ t('shortcuts.noResults') }}</p>
    </div>
    <section v-for="group in groups" :key="group.category" class="shortcuts-group">
      <h3 class="shortcuts-group__title">{{ t(`shortcuts.categories.${group.category}`) }}</h3>
      <dl class="shortcuts-rows">
        <div v-for="shortcut in group.items" :key="shortcut.id" class="shortcuts-row">
          <dt>{{ t(`shortcuts.actions.${shortcut.id}`) }}</dt>
          <dd>
            <span class="shortcuts-keys">
              <kbd
                v-for="(part, index) in shortcutParts(shortcut.id, platform)"
                :key="index"
                class="nd-kbd"
              >{{ part }}</kbd>
            </span>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.shortcuts-group + .shortcuts-group {
  margin-top: 22px;
}

.shortcuts-group__title {
  margin: 0 0 8px;
  color: var(--nd-text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.shortcuts-rows {
  margin: 0;
}

.shortcuts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 34px;
  border-bottom: 1px solid color-mix(in srgb, var(--nd-border) 60%, transparent);
}

.shortcuts-row:last-child {
  border-bottom: none;
}

.shortcuts-row dt {
  color: var(--nd-text);
}

.shortcuts-row dd {
  margin: 0;
}

.shortcuts-keys {
  display: inline-flex;
  gap: 3px;
}
</style>
