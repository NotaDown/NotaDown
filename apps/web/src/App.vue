<script setup lang="ts">
import { provide } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  APP_COMMANDS_KEY,
  useAppCommands,
} from '@/composables/use-app-commands'
import { useGlobalShortcuts } from '@/composables/use-global-shortcuts'
import { useAppLifecycle } from '@/composables/use-app-lifecycle'
import { useFileDrop } from '@/composables/use-file-drop'
import { useWindowChrome } from '@/composables/use-window-chrome'
import { useUiStore } from '@/stores/ui'
import { usesNativeTitleBar } from '@/window-chrome'
import AppTopBar from '@/components/AppTopBar.vue'
import AppActivityBar from '@/components/AppActivityBar.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import AppStatusBar from '@/components/AppStatusBar.vue'
import EditorPane from '@/components/EditorPane.vue'
import ToastHost from '@/components/common/ToastHost.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import UnsavedDialog from '@/components/dialogs/UnsavedDialog.vue'
import DefaultAppDialog from '@/components/dialogs/DefaultAppDialog.vue'
import UpdateDialog from '@/components/dialogs/UpdateDialog.vue'
import SettingsDialog from '@/components/dialogs/SettingsDialog.vue'
import ShortcutsDialog from '@/components/dialogs/ShortcutsDialog.vue'
import CommandPalette from '@/components/dialogs/CommandPalette.vue'
import QuickOpen from '@/components/dialogs/QuickOpen.vue'
import HistoryPreviewDialog from '@/components/dialogs/HistoryPreviewDialog.vue'

const commands = useAppCommands()
provide(APP_COMMANDS_KEY, commands)
useAppLifecycle(commands)
useGlobalShortcuts(commands)
useFileDrop()
useWindowChrome()

const ui = useUiStore()
const { t } = useI18n()
</script>

<template>
  <div
    class="app"
    :class="{
      'nd-modal-open': ui.hasBlockingModal,
      'is-native-chrome': usesNativeTitleBar,
    }"
  >
    <AppTopBar v-if="!usesNativeTitleBar" />

    <div class="app__body">
      <AppActivityBar />
      <AppSidebar v-show="ui.sidebarOpen" />
      <button
        v-if="ui.sidebarOpen"
        type="button"
        class="app__backdrop"
        :aria-label="t('common.collapse')"
        @click="ui.toggleSidebar(false)"
      />
      <main class="app__main">
        <AppTabBar />
        <EditorPane />
      </main>
    </div>

    <AppStatusBar />

    <ToastHost />
    <ConfirmDialog />
    <UnsavedDialog />
    <DefaultAppDialog />
    <UpdateDialog />
    <SettingsDialog />
    <ShortcutsDialog />
    <CommandPalette />
    <QuickOpen />
    <HistoryPreviewDialog />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--nd-bg);
}

.app.is-native-chrome {
  --nd-topbar-height: 0px;
}

.app__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.app__backdrop {
  display: none;
}

@media (max-width: 720px) {
  .app__backdrop {
    position: fixed;
    inset: var(--nd-topbar-height) 0 var(--nd-statusbar-height) 0;
    z-index: 45;
    display: block;
    border: 0;
    background: rgba(0, 0, 0, 0.32);
  }
}
</style>
