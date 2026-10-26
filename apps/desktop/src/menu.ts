import {
  app,
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron'
import { DESKTOP_MENU_COMMAND_CHANNEL } from '@notadown/shared'
import { menuLabels, type MenuLocale } from './menu-labels'

export function installMenu(
  getWindow: () => BrowserWindow | null,
  locale: MenuLocale = 'en-US',
): void {
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged
  const labels = menuLabels(locale)

  const send = (command: string): void => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(DESKTOP_MENU_COMMAND_CHANNEL, command)
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: labels.file,
      submenu: [
        { label: labels.newFile, accelerator: 'CmdOrCtrl+N', click: () => send('file.new') },
        {
          label: labels.openFile,
          accelerator: 'CmdOrCtrl+O',
          click: () => send('file.open'),
        },
        {
          label: labels.openFolder,
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('file.openWorkspace'),
        },
        {
          label: labels.closeFolder,
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => send('file.closeWorkspace'),
        },
        { type: 'separator' },
        { label: labels.save, accelerator: 'CmdOrCtrl+S', click: () => send('file.save') },
        {
          label: labels.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('file.saveAs'),
        },
        { type: 'separator' },
        { label: labels.exportHtml, click: () => send('file.exportHtml') },
        { label: labels.exportPdf, click: () => send('file.exportPdf') },
        { type: 'separator' },
        {
          label: labels.closeTab,
          accelerator: 'CmdOrCtrl+W',
          click: () => send('file.closeTab'),
        },
        ...(isMac
          ? []
          : ([
              { type: 'separator' },
              { role: 'quit', label: labels.quit },
            ] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: labels.edit,
      submenu: [
        { role: 'undo', label: labels.undo },
        { role: 'redo', label: labels.redo },
        { type: 'separator' },
        { role: 'cut', label: labels.cut },
        { role: 'copy', label: labels.copy },
        { role: 'paste', label: labels.paste },
        { role: 'selectAll', label: labels.selectAll },
        { type: 'separator' },
        { label: labels.find, accelerator: 'CmdOrCtrl+F', click: () => send('edit.find') },
      ],
    },
    {
      label: labels.view,
      submenu: [
        {
          label: labels.commandPalette,
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('navigation.palette'),
        },
        {
          label: labels.quickOpen,
          accelerator: 'CmdOrCtrl+P',
          click: () => send('navigation.quickOpen'),
        },
        { type: 'separator' },
        {
          label: labels.toggleSidebar,
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => send('view.toggleSidebar'),
        },
        { label: labels.files, click: () => send('view.files') },
        {
          label: labels.search,
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('view.search'),
        },
        {
          label: labels.outline,
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () => send('view.outline'),
        },
        {
          label: labels.history,
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => send('view.history'),
        },
        { type: 'separator' },
        {
          label: labels.sourceMode,
          accelerator: 'CmdOrCtrl+/',
          click: () => send('view.sourceMode'),
        },
        {
          label: labels.focusMode,
          accelerator: 'F8',
          click: () => send('view.focusMode'),
        },
        {
          label: labels.typewriterMode,
          accelerator: 'F9',
          click: () => send('view.typewriterMode'),
        },
        { label: labels.toggleColorMode, click: () => send('view.colorMode') },
        { type: 'separator' },
        {
          label: labels.settings,
          accelerator: 'CmdOrCtrl+,',
          click: () => send('settings.open'),
        },
        ...(isDev
          ? ([
              { type: 'separator' },
              { role: 'reload' },
              { role: 'toggleDevTools' },
            ] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    { role: 'windowMenu', label: labels.window },
    {
      label: labels.help,
      submenu: [
        {
          label: labels.keyboardShortcuts,
          accelerator: 'F1',
          click: () => send('help.shortcuts'),
        },
        { label: labels.about, click: () => send('help.about') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
