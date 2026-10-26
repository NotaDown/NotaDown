import { onBeforeUnmount, onMounted } from 'vue'
import {
  SHORTCUT_MAP,
  type ShortcutPlatform,
} from '@notadown/shared'
import type { EditorCommand } from '@notadown/editor'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { getEditor } from '@/editor-registry'
import type { AppCommands } from './use-app-commands'

const COMMAND_BINDINGS: Array<[shortcutId: string, commandId: string]> = [
  ['file.new', 'file.new'],
  ['file.open', 'file.open'],
  ['workspace.open', 'file.openWorkspace'],
  ['file.save', 'file.save'],
  ['file.saveAs', 'file.saveAs'],
  ['file.closeTab', 'file.closeTab'],
  ['edit.find', 'edit.find'],
  ['view.toggleSidebar', 'view.toggleSidebar'],
  ['view.search', 'view.search'],
  ['view.outline', 'view.outline'],
  ['view.history', 'view.history'],
  ['view.sourceMode', 'view.sourceMode'],
  ['view.focusMode', 'view.focusMode'],
  ['view.typewriterMode', 'view.typewriterMode'],
  ['navigation.commandPalette', 'navigation.palette'],
  ['navigation.quickOpen', 'navigation.quickOpen'],
  ['settings.open', 'settings.open'],
  ['help.shortcuts', 'help.shortcuts'],
]

const FORMAT_BINDINGS: Array<[shortcutId: string, command: EditorCommand]> = [
  ['format.bold', 'bold'],
  ['format.italic', 'italic'],
  ['format.strikethrough', 'strikethrough'],
  ['format.inlineCode', 'inlineCode'],
  ['format.link', 'link'],
  ['format.heading1', 'heading1'],
  ['format.heading2', 'heading2'],
  ['format.heading3', 'heading3'],
  ['format.heading4', 'heading4'],
  ['format.heading5', 'heading5'],
  ['format.heading6', 'heading6'],
  ['format.bulletList', 'bulletList'],
  ['format.orderedList', 'orderedList'],
  ['format.taskList', 'taskList'],
  ['format.blockquote', 'blockquote'],
  ['format.codeBlock', 'codeBlock'],
  ['format.math', 'math'],
  ['format.mermaid', 'mermaid'],
]

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])'

export function useGlobalShortcuts(commands: AppCommands): void {
  const tabs = useTabsStore()
  const ui = useUiStore()
  const platform = commands.platform

  // ProseMirror consumes Ctrl+A before bubble-phase listeners reach the window.
  function onSelectAllKeydown(event: KeyboardEvent): void {
    if (event.isComposing || !ui.hasBlockingModal) return
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
    if (event.key.toLowerCase() !== 'a') return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('.nd-dialog') &&
      target.closest(EDITABLE_SELECTOR)
    ) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return

    if (event.key === 'Escape' && !event.defaultPrevented) {
      if (ui.closeTopLayer()) event.preventDefault()
      return
    }

    if (ui.hasBlockingModal) return
    if (event.defaultPrevented) return

    if (eventMatches(event, 'tab.next', platform)) {
      event.preventDefault()
      cycleTab(1)
      return
    }
    if (eventMatches(event, 'tab.previous', platform)) {
      event.preventDefault()
      cycleTab(-1)
      return
    }

    for (const [shortcutId, commandId] of COMMAND_BINDINGS) {
      if (!eventMatches(event, shortcutId, platform)) continue
      event.preventDefault()
      void commands.run(commandId)
      return
    }

    const active = tabs.activeTab
    const focusedEditor =
      active?.viewMode === 'rich' &&
      document.activeElement instanceof Element &&
      document.activeElement.closest('.nd-editor') !== null
    if (!focusedEditor || !active) return

    for (const [shortcutId, command] of FORMAT_BINDINGS) {
      if (!eventMatches(event, shortcutId, platform)) continue
      if (getEditor(active.key)?.runCommand(command)) event.preventDefault()
      return
    }
  }

  function cycleTab(direction: 1 | -1): void {
    const list = tabs.tabs
    if (list.length < 2) return
    const index = list.findIndex((tab) => tab.key === tabs.activeKey)
    const next = list[(index + direction + list.length) % list.length]
    if (next) tabs.activate(next.key)
  }

  onMounted(() => {
    window.addEventListener('keydown', onSelectAllKeydown, true)
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onSelectAllKeydown, true)
    window.removeEventListener('keydown', onKeydown)
  })
}

function eventMatches(
  event: KeyboardEvent,
  shortcutId: string,
  platform: ShortcutPlatform,
): boolean {
  const definition = SHORTCUT_MAP.get(shortcutId)
  if (!definition) return false
  const keys =
    platform === 'mac' && definition.macKeys ? definition.macKeys : definition.keys
  const parts = keys.split('+')
  const mod = parts.includes('Mod')
  const ctrl = parts.includes('Ctrl')
  const shift = parts.includes('Shift')
  const alt = parts.includes('Alt')
  const key = parts[parts.length - 1]

  const expectedCtrl = platform === 'mac' ? ctrl : ctrl || mod
  const expectedMeta = platform === 'mac' ? mod : false
  if (event.ctrlKey !== expectedCtrl) return false
  if (event.metaKey !== expectedMeta) return false
  if (event.shiftKey !== shift) return false
  if (event.altKey !== alt) return false

  if (/^[0-9]$/.test(key)) return event.code === `Digit${key}` || event.code === `Numpad${key}`
  if (/^[A-Z]$/.test(key)) return event.code === `Key${key}`
  return event.key.toLowerCase() === key.toLowerCase()
}
