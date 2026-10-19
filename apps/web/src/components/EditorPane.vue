<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import EditorTabView from './EditorTabView.vue'
import FindBar from './FindBar.vue'
import WelcomeView from './WelcomeView.vue'

const tabs = useTabsStore()
const settings = useSettingsStore()

const mountedKeys = ref(new Set<string>())

watch(
  () => tabs.activeKey,
  (key) => {
    if (!key || mountedKeys.value.has(key)) return
    const next = new Set(mountedKeys.value)
    next.add(key)
    mountedKeys.value = next
  },
  { immediate: true, flush: 'sync' },
)

watch(
  () => tabs.tabs.map((tab) => tab.key),
  (keys) => {
    const alive = new Set(keys)
    const next = new Set([...mountedKeys.value].filter((key) => alive.has(key)))
    if (next.size !== mountedKeys.value.size) mountedKeys.value = next
  },
)
</script>

<template>
  <div class="editor-pane">
    <WelcomeView v-if="tabs.tabs.length === 0" />

    <template v-else>
      <div
        v-for="tab in tabs.tabs"
        v-show="tab.key === tabs.activeKey"
        :key="`${tab.key}:${settings.locale}`"
        class="editor-pane__layer"
      >
        <EditorTabView v-if="mountedKeys.has(tab.key)" :tab="tab" />
        <div v-else class="editor-pane__loading">
          <span class="nd-spinner" />
        </div>
      </div>
    </template>

    <FindBar v-if="tabs.activeTab" />
  </div>
</template>

<style scoped>
.editor-pane {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--nd-bg);
}

.editor-pane__layer {
  position: absolute;
  inset: 0;
}

.editor-pane__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
