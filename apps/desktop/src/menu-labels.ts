import type { LocalePreference } from '@notadown/shared'

export type MenuLocale = 'en-US' | 'zh-CN'

export interface MenuLabels {
  file: string
  newFile: string
  openFile: string
  openFolder: string
  save: string
  saveAs: string
  exportHtml: string
  exportPdf: string
  closeTab: string
  quit: string
  edit: string
  undo: string
  redo: string
  cut: string
  copy: string
  paste: string
  selectAll: string
  find: string
  view: string
  commandPalette: string
  quickOpen: string
  toggleSidebar: string
  files: string
  search: string
  outline: string
  history: string
  sourceMode: string
  focusMode: string
  typewriterMode: string
  toggleColorMode: string
  settings: string
  window: string
  help: string
  keyboardShortcuts: string
  about: string
}

const EN: MenuLabels = {
  file: 'File',
  newFile: 'New',
  openFile: 'Open File…',
  openFolder: 'Open Folder…',
  save: 'Save',
  saveAs: 'Save As…',
  exportHtml: 'Export as HTML…',
  exportPdf: 'Export as PDF…',
  closeTab: 'Close Tab',
  quit: 'Quit',
  edit: 'Edit',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  selectAll: 'Select All',
  find: 'Find',
  view: 'View',
  commandPalette: 'Command Palette…',
  quickOpen: 'Quick Open…',
  toggleSidebar: 'Toggle Sidebar',
  files: 'Files',
  search: 'Search',
  outline: 'Outline',
  history: 'History',
  sourceMode: 'Source Mode',
  focusMode: 'Focus Mode',
  typewriterMode: 'Typewriter Mode',
  toggleColorMode: 'Toggle Light / Dark',
  settings: 'Settings…',
  window: 'Window',
  help: 'Help',
  keyboardShortcuts: 'Keyboard Shortcuts',
  about: 'About NotaDown',
}

const ZH: MenuLabels = {
  file: '文件',
  newFile: '新建',
  openFile: '打开文件…',
  openFolder: '打开文件夹…',
  save: '保存',
  saveAs: '另存为…',
  exportHtml: '导出为 HTML…',
  exportPdf: '导出为 PDF…',
  closeTab: '关闭标签页',
  quit: '退出',
  edit: '编辑',
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  selectAll: '全选',
  find: '查找',
  view: '视图',
  commandPalette: '命令面板…',
  quickOpen: '快速打开…',
  toggleSidebar: '切换侧边栏',
  files: '文件',
  search: '搜索',
  outline: '大纲',
  history: '历史',
  sourceMode: '源码模式',
  focusMode: '专注模式',
  typewriterMode: '打字机模式',
  toggleColorMode: '切换浅色 / 深色',
  settings: '设置…',
  window: '窗口',
  help: '帮助',
  keyboardShortcuts: '键盘快捷键',
  about: '关于 NotaDown',
}

export function menuLabels(locale: MenuLocale): MenuLabels {
  return locale === 'zh-CN' ? ZH : EN
}

export function resolveMenuLocale(
  preference: LocalePreference | undefined,
  systemLocale: string,
): MenuLocale {
  if (preference === 'en-US' || preference === 'zh-CN') return preference
  return systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}
