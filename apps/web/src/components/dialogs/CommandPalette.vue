<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { fuzzyFilter } from '@notadown/shared'
import { useUiStore } from '@/stores/ui'
import {
  useInjectedCommands,
  type AppCommand,
} from '@/composables/use-app-commands'

const { t } = useI18n()
const ui = useUiStore()
const commands = useInjectedCommands()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const results = computed(() =>
  fuzzyFilter(query.value.trim(), commands.commands.value, (command) => command.title),
)

watch(
  () => ui.paletteOpen,
  async (open) => {
    if (!open) return
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    inputRef.value?.focus()
  },
)

watch(query, () => {
  activeIndex.value = 0
})

watch(activeIndex, async () => {
  await nextTick()
  const children = listRef.value?.children
  const element = children?.[activeIndex.value]
  if (element instanceof HTMLElement) element.scrollIntoView({ block: 'nearest' })
})

function execute(command: AppCommand): void {
  ui.paletteOpen = false
  void commands.run(command.id)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    ui.paletteOpen = false
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value = (activeIndex.value + 1) % results.value.length
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (!results.value.length) return
    activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const command = results.value[activeIndex.value]
    if (command) execute(command)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div v-if="ui.paletteOpen" class="nd-overlay" @click.self="ui.paletteOpen = false">
        <div class="nd-dialog command-palette" role="dialog" aria-modal="true">
          <div class="command-palette__search">
            <Search :size="16" class="command-palette__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="command-palette__input"
              :placeholder="t('command.placeholder')"
              @keydown="onKeydown"
            />
          </div>
          <div v-if="results.length === 0" class="nd-empty command-palette__empty">
            <p class="nd-empty-text">{{ t('command.noResults') }}</p>
          </div>
          <ul v-else ref="listRef" class="command-palette__list nd-scroll">
            <li v-for="(command, index) in results" :key="command.id">
              <button
                type="button"
                class="command-palette__item"
                :class="{ 'is-active': index === activeIndex }"
                @mousemove="activeIndex = index"
                @click="execute(command)"
              >
                <span class="command-palette__label">{{ command.title }}</span>
                <span v-if="command.shortcut" class="command-palette__shortcut">
                  {{ commands.shortcut(command.shortcut) }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.command-palette {
  width: min(560px, 100%);
  max-height: 62vh;
  padding: 0;
}

.command-palette__search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--nd-border);
}

.command-palette__icon {
  position: absolute;
  left: 16px;
  color: var(--nd-text-muted);
  pointer-events: none;
}

.command-palette__input {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 42px;
  border: none;
  background: transparent;
  color: var(--nd-text);
  font-size: 14px;
  outline: none;
}

.command-palette__input::placeholder {
  color: var(--nd-text-muted);
}

.command-palette__list {
  flex: 1;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
}

.command-palette__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: var(--nd-radius-sm);
  background: transparent;
  color: var(--nd-text);
  font-size: 12.5px;
  text-align: left;
}

.command-palette__item.is-active {
  background: var(--nd-surface);
}

.command-palette__label {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__shortcut {
  flex: 0 0 auto;
  color: var(--nd-text-muted);
  font-size: 10.5px;
}

.command-palette__empty {
  flex: none;
  padding: 26px;
}
</style>
