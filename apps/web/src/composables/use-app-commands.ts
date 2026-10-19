import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  shortcutText,
  type ShortcutPlatform,
} from '@notadown/shared'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { platform as appPlatform } from '@/platform'
import { describeError } from '@/errors'

export type CommandGroup = 'file' | 'edit' | 'view' | 'navigation' | 'settings' | 'help'

export interface AppCommand {
  id: string
  group: CommandGroup
  title: string
  shortcut?: string
  run: () => void | Promise<void>
}

export interface AppCommands {
  commands: ComputedRef<AppCommand[]>
  run: (id: string) => Promise<void>
  get: (id: string) => AppCommand | undefined
  shortcut: (id: string) => string
  platform: ShortcutPlatform
}

export const APP_COMMANDS_KEY: InjectionKey<AppCommands> = Symbol('notadown:commands')

export function useAppCommands(): AppCommands {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const tabs = useTabsStore()
  const ui = useUiStore()
  const workspace = useWorkspaceStore()

  const platform = shortcutPlatform()

  const commands: ComputedRef<AppCommand[]> = computed(() => [
    {
      id: 'file.new',
      group: 'file',
      title: t('menu.newDocument'),
      shortcut: 'file.new',
      run: () => {
        tabs.createUntitled()
      },
    },
    {
      id: 'file.open',
      group: 'file',
      title: t('menu.openFile'),
      shortcut: 'file.open',
      run: () => tabs.openFileDialog(),
    },
    {
      id: 'file.openWorkspace',
      group: 'file',
      title: t('menu.openFolder'),
      shortcut: 'workspace.open',
      run: openWorkspaceFolder,
    },
    {
      id: 'file.save',
      group: 'file',
      title: t('menu.save'),
      shortcut: 'file.save',
      run: () => tabs.saveActive(),
    },
    {
      id: 'file.saveAs',
      group: 'file',
      title: t('menu.saveAs'),
      shortcut: 'file.saveAs',
      run: () => tabs.saveActiveAs(),
    },
    {
      id: 'file.closeTab',
      group: 'file',
      title: t('menu.closeTab'),
      shortcut: 'file.closeTab',
      run: () => {
        if (tabs.activeKey) void tabs.closeTab(tabs.activeKey)
      },
    },
    {
      id: 'edit.find',
      group: 'edit',
      title: t('menu.find'),
      shortcut: 'edit.find',
      run: () => {
        if (tabs.activeTab) ui.openFind()
      },
    },
    {
      id: 'view.toggleSidebar',
      group: 'view',
      title: t('menu.toggleSidebar'),
      shortcut: 'view.toggleSidebar',
      run: () => ui.toggleSidebar(),
    },
    {
      id: 'view.files',
      group: 'view',
      title: t('sidebar.files'),
      run: () => ui.setSidebarView('files'),
    },
    {
      id: 'view.search',
      group: 'view',
      title: t('menu.search'),
      shortcut: 'view.search',
      run: () => ui.focusSearch(),
    },
    {
      id: 'view.outline',
      group: 'view',
      title: t('menu.outline'),
      shortcut: 'view.outline',
      run: () => ui.setSidebarView('outline'),
    },
    {
      id: 'view.history',
      group: 'view',
      title: t('menu.history'),
      shortcut: 'view.history',
      run: () => ui.setSidebarView('history'),
    },
    {
      id: 'view.sourceMode',
      group: 'view',
      title: t('menu.sourceMode'),
      shortcut: 'view.sourceMode',
      run: () => tabs.toggleViewMode(),
    },
    {
      id: 'view.focusMode',
      group: 'view',
      title: t('menu.focusMode'),
      shortcut: 'view.focusMode',
      run: toggleFocusMode,
    },
    {
      id: 'view.typewriterMode',
      group: 'view',
      title: t('menu.typewriterMode'),
      shortcut: 'view.typewriterMode',
      run: toggleTypewriterMode,
    },
    {
      id: 'view.colorMode',
      group: 'view',
      title: t('menu.toggleColorMode'),
      run: toggleColorMode,
    },
    {
      id: 'navigation.palette',
      group: 'navigation',
      title: t('menu.commandPalette'),
      shortcut: 'navigation.commandPalette',
      run: () => {
        ui.paletteOpen = true
      },
    },
    {
      id: 'navigation.quickOpen',
      group: 'navigation',
      title: t('command.quickOpenTitle'),
      shortcut: 'navigation.quickOpen',
      run: () => {
        ui.quickOpenOpen = true
      },
    },
    {
      id: 'settings.open',
      group: 'settings',
      title: t('menu.settings'),
      shortcut: 'settings.open',
      run: () => ui.openSettings(),
    },
    {
      id: 'help.shortcuts',
      group: 'help',
      title: t('menu.keyboardShortcuts'),
      shortcut: 'help.shortcuts',
      run: () => {
        ui.shortcutsOpen = true
      },
    },
    {
      id: 'help.about',
      group: 'help',
      title: t('menu.about'),
      run: () => ui.openSettings('about'),
    },
  ])

  async function openWorkspaceFolder(): Promise<void> {
    if (!platformSupportsFolder()) {
      ui.toast('warning', t('web.folderUnavailable'))
      return
    }
    if (tabs.tabs.some((tab) => tab.ref.origin === 'workspace')) {
      const closed = await tabs.closeWorkspaceTabs()
      if (!closed) return
    }
    try {
      const opened = await workspace.open()
      if (!opened) return
      ui.toast('success', t('toasts.workspaceOpened', { name: workspace.info?.name ?? '' }))
      ui.setSidebarView('files')
    } catch (error) {
      ui.toast('error', t('toasts.openFailed'), describeError(error))
    }
  }

  function toggleFocusMode(): void {
    const value = !settings.settings.focusMode
    settings.update({ focusMode: value })
    ui.toast('info', t(value ? 'editor.focusModeOn' : 'editor.focusModeOff'))
  }

  function toggleTypewriterMode(): void {
    const value = !settings.settings.typewriterMode
    settings.update({ typewriterMode: value })
    ui.toast('info', t(value ? 'editor.typewriterModeOn' : 'editor.typewriterModeOff'))
  }

  function toggleColorMode(): void {
    settings.update({ colorMode: settings.effectiveMode === 'dark' ? 'light' : 'dark' })
  }

  function get(id: string): AppCommand | undefined {
    return commands.value.find((command) => command.id === id)
  }

  async function run(id: string): Promise<void> {
    const command = get(id)
    if (!command) return
    try {
      await command.run()
    } catch (error) {
      ui.toast('error', t('errors.generic'), describeError(error))
    }
  }

  return {
    commands,
    run,
    get,
    shortcut: (id: string) => shortcutText(id, platform),
    platform,
  }
}

export function useInjectedCommands(): AppCommands {
  const commands = inject(APP_COMMANDS_KEY)
  if (!commands) throw new Error('App commands are not available')
  return commands
}

export function shortcutPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'other'
  if (window.notadown?.platform === 'darwin') return 'mac'
  return /mac/i.test(navigator.userAgent) ? 'mac' : 'other'
}

function platformSupportsFolder(): boolean {
  return appPlatform.capabilities.folderWorkspace
}

export const COMMAND_GROUP_ORDER: CommandGroup[] = [
  'file',
  'edit',
  'view',
  'navigation',
  'settings',
  'help',
]
