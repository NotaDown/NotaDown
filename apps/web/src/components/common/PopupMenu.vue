<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import type { MenuItem } from './menu-types'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  items: MenuItem[]
  width?: number
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

const menuRef = ref<HTMLElement | null>(null)
const position = ref({ x: props.x, y: props.y })

const menuStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  width: props.width ? `${props.width}px` : undefined,
}))

function clamp(): void {
  const width = props.width ?? 200
  const margin = 8
  let x = Math.min(props.x, window.innerWidth - width - margin)
  let y = props.y
  const height = menuRef.value?.offsetHeight ?? 0
  if (height && y + height > window.innerHeight - margin) {
    y = Math.max(margin, window.innerHeight - height - margin)
  }
  position.value = { x: Math.max(margin, x), y }
}

function close(): void {
  emit('close')
}

function select(item: MenuItem): void {
  if (item.disabled || item.separator) return
  emit('select', item.id)
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  close()
}

watch(
  () => [props.open, props.x, props.y],
  async () => {
    if (!props.open) return
    position.value = { x: props.x, y: props.y }
    await nextTick()
    clamp()
  },
  { immediate: true },
)

onClickOutside(menuRef, () => {
  if (props.open) close()
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="nd-fade">
      <div
        v-if="open"
        ref="menuRef"
        class="nd-menu popup-menu"
        role="menu"
        :style="menuStyle"
        @contextmenu.prevent
      >
        <template v-for="item in items" :key="item.id">
          <div v-if="item.separator" class="nd-menu-separator" role="separator" />
          <button
            v-else
            type="button"
            role="menuitem"
            class="nd-menu-item"
            :class="{ 'is-danger': item.danger }"
            :disabled="item.disabled"
            @click="select(item)"
          >
            <span class="popup-menu__label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="nd-menu-shortcut">{{ item.shortcut }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.popup-menu {
  position: fixed;
  z-index: 220;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
}

.popup-menu__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
