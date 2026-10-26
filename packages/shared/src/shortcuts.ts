export type ShortcutCategory = 'file' | 'edit' | 'format' | 'view' | 'navigation' | 'help'

export interface ShortcutDefinition {
  id: string
  category: ShortcutCategory
  keys: string
  macKeys?: string
}

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'file.new', category: 'file', keys: 'Mod+N' },
  { id: 'file.open', category: 'file', keys: 'Mod+O' },
  { id: 'workspace.open', category: 'file', keys: 'Mod+Shift+O' },
  { id: 'workspace.close', category: 'file', keys: 'Mod+Shift+W' },
  { id: 'file.save', category: 'file', keys: 'Mod+S' },
  { id: 'file.saveAs', category: 'file', keys: 'Mod+Shift+S' },
  { id: 'file.closeTab', category: 'file', keys: 'Mod+W' },
  { id: 'workspace.renameEntry', category: 'file', keys: 'F2', macKeys: 'Enter' },
  { id: 'tab.next', category: 'file', keys: 'Ctrl+Tab' },
  { id: 'tab.previous', category: 'file', keys: 'Ctrl+Shift+Tab' },
  { id: 'edit.undo', category: 'edit', keys: 'Mod+Z' },
  { id: 'edit.redo', category: 'edit', keys: 'Mod+Shift+Z', macKeys: 'Mod+Shift+Z' },
  { id: 'edit.find', category: 'edit', keys: 'Mod+F' },
  { id: 'format.bold', category: 'format', keys: 'Mod+B' },
  { id: 'format.italic', category: 'format', keys: 'Mod+I' },
  { id: 'format.strikethrough', category: 'format', keys: 'Mod+Shift+X' },
  { id: 'format.inlineCode', category: 'format', keys: 'Mod+E' },
  { id: 'format.link', category: 'format', keys: 'Mod+K' },
  { id: 'format.heading1', category: 'format', keys: 'Mod+Alt+1' },
  { id: 'format.heading2', category: 'format', keys: 'Mod+Alt+2' },
  { id: 'format.heading3', category: 'format', keys: 'Mod+Alt+3' },
  { id: 'format.heading4', category: 'format', keys: 'Mod+Alt+4' },
  { id: 'format.heading5', category: 'format', keys: 'Mod+Alt+5' },
  { id: 'format.heading6', category: 'format', keys: 'Mod+Alt+6' },
  { id: 'format.bulletList', category: 'format', keys: 'Mod+Shift+8' },
  { id: 'format.orderedList', category: 'format', keys: 'Mod+Shift+7' },
  { id: 'format.taskList', category: 'format', keys: 'Mod+Shift+9' },
  { id: 'format.blockquote', category: 'format', keys: 'Mod+Shift+Q' },
  { id: 'format.codeBlock', category: 'format', keys: 'Mod+Alt+C' },
  { id: 'format.math', category: 'format', keys: 'Mod+Alt+M' },
  { id: 'format.mermaid', category: 'format', keys: 'Mod+Alt+D' },
  { id: 'view.toggleSidebar', category: 'view', keys: 'Mod+Shift+1' },
  { id: 'view.search', category: 'view', keys: 'Mod+Shift+F' },
  { id: 'view.outline', category: 'view', keys: 'Mod+Shift+2' },
  { id: 'view.history', category: 'view', keys: 'Mod+Shift+H' },
  { id: 'view.sourceMode', category: 'view', keys: 'Mod+/' },
  { id: 'view.focusMode', category: 'view', keys: 'F8' },
  { id: 'view.typewriterMode', category: 'view', keys: 'F9' },
  { id: 'navigation.commandPalette', category: 'navigation', keys: 'Mod+Shift+P' },
  { id: 'navigation.quickOpen', category: 'navigation', keys: 'Mod+P' },
  { id: 'settings.open', category: 'navigation', keys: 'Mod+,' },
  { id: 'help.shortcuts', category: 'help', keys: 'F1' },
]

export const SHORTCUT_MAP = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

export type ShortcutPlatform = 'mac' | 'other'

export function shortcutParts(id: string, platform: ShortcutPlatform): string[] {
  const definition = SHORTCUT_MAP.get(id)
  if (!definition) return []
  const keys = platform === 'mac' && definition.macKeys ? definition.macKeys : definition.keys
  return keys.split('+').map((part) => {
    if (part === 'Mod') return platform === 'mac' ? '⌘' : 'Ctrl'
    if (part === 'Ctrl') return platform === 'mac' ? '⌃' : 'Ctrl'
    if (part === 'Shift') return platform === 'mac' ? '⇧' : 'Shift'
    if (part === 'Alt') return platform === 'mac' ? '⌥' : 'Alt'
    return part
  })
}

export function shortcutText(id: string, platform: ShortcutPlatform): string {
  const parts = shortcutParts(id, platform)
  if (!parts.length) return ''
  return platform === 'mac' ? parts.join('') : parts.join('+')
}

export function matchesShortcut(
  event: KeyboardEvent | MouseEvent,
  id: string,
  platform: ShortcutPlatform,
): boolean {
  const definition = SHORTCUT_MAP.get(id)
  if (!definition) return false
  const keys = platform === 'mac' && definition.macKeys ? definition.macKeys : definition.keys
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

  const eventKey = 'key' in event ? event.key : ''
  const normalizedEventKey = eventKey.length === 1 ? eventKey.toUpperCase() : eventKey
  if (key.length === 1) return normalizedEventKey === key.toUpperCase()
  return normalizedEventKey === key
}
