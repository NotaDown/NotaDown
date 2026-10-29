<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import { Check, MoveHorizontal } from '@lucide/vue'
import type { PageWidthMode } from '@notadown/shared'
import { PAGE_WIDTH_MODES } from '@/page-widths'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const settings = useSettingsStore()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

const current = computed(
  () =>
    PAGE_WIDTH_MODES.find((mode) => mode.id === settings.settings.pageWidth) ??
    PAGE_WIDTH_MODES[1],
)

const glyphWidths: Record<PageWidthMode, string> = {
  'very-narrow': '5px',
  narrow: '9px',
  default: '13px',
  wide: '17px',
  full: '21px',
}

function choose(id: PageWidthMode): void {
  settings.update({ pageWidth: id })
  open.value = false
}

onClickOutside(root, () => {
  open.value = false
})
</script>

<template>
  <div ref="root" class="width-control" @keydown.esc.stop="open = false">
    <Transition name="nd-fade">
      <div
        v-if="open"
        class="width-control__menu"
        role="menu"
        :aria-label="t('settings.appearanceSection.pageWidth')"
      >
        <button
          v-for="mode in PAGE_WIDTH_MODES"
          :key="mode.id"
          type="button"
          role="menuitemradio"
          class="width-control__option"
          :class="{ 'is-active': mode.id === settings.settings.pageWidth }"
          :aria-checked="mode.id === settings.settings.pageWidth"
          @click="choose(mode.id)"
        >
          <span class="width-control__glyph" aria-hidden="true">
            <span class="width-control__line" :style="{ width: glyphWidths[mode.id] }" />
          </span>
          <span class="width-control__name">{{ t(mode.label) }}</span>
          <Check
            v-if="mode.id === settings.settings.pageWidth"
            :size="13"
            class="width-control__check"
          />
        </button>
      </div>
    </Transition>

    <button
      type="button"
      class="width-control__trigger"
      :title="t('settings.appearanceSection.pageWidth')"
      :aria-label="t('settings.appearanceSection.pageWidth')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MoveHorizontal :size="13" />
      <span class="width-control__label">{{ t(current.label) }}</span>
    </button>
  </div>
</template>

<style scoped>
.width-control {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 20;
  display: flex;
}

.width-control__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--nd-control-height-sm);
  padding: 0 10px;
  border: 1px solid var(--nd-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nd-bg-elevated) 88%, transparent);
  color: var(--nd-text-muted);
  font-size: 11px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(6px);
  opacity: 0.86;
  transition: opacity 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.width-control__trigger:hover,
.width-control__trigger:focus-visible,
.width-control__trigger[aria-expanded='true'] {
  opacity: 1;
  border-color: var(--nd-border-strong);
  color: var(--nd-text);
}

.width-control__label {
  line-height: 1;
}

.width-control__menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 156px;
  padding: 5px;
  border: 1px solid var(--nd-border);
  border-radius: 10px;
  background: var(--nd-bg-elevated);
  box-shadow: var(--nd-shadow);
}

.width-control__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: var(--nd-menu-item-height);
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--nd-text-secondary);
  font-size: 12px;
  text-align: left;
}

.width-control__option:hover {
  background: var(--nd-surface);
  color: var(--nd-text);
}

.width-control__option.is-active {
  color: var(--nd-text);
}

.width-control__glyph {
  display: inline-flex;
  flex: 0 0 22px;
  justify-content: center;
}

.width-control__line {
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.55;
}

.width-control__option.is-active .width-control__line {
  background: var(--nd-accent);
  opacity: 1;
}

.width-control__name {
  flex: 1;
  white-space: nowrap;
}

.width-control__check {
  flex: 0 0 auto;
  color: var(--nd-accent);
}

@media (max-width: 720px) {
  .width-control {
    display: none;
  }
}
</style>
