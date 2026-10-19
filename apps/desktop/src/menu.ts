import {
  app,
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron'
import { DESKTOP_MENU_COMMAND_CHANNEL } from '@notadown/shared'

export function installMenu(getWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged

  const send = (command: string): void => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(DESKTOP_MENU_COMMAND_CHANNEL, command)
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('file.new') },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => send('file.open') },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => send('file.openWorkspace'),
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file.save') },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('file.saveAs'),
        },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => send('file.exportHtml') },
        { label: 'Export as PDF…', click: () => send('file.exportPdf') },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => send('file.closeTab'),
        },
        ...(isMac
          ? []
          : ([{ type: 'separator' }, { role: 'quit' }] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('edit.find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => send('navigation.palette'),
        },
        {
          label: 'Quick Open…',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('navigation.quickOpen'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => send('view.toggleSidebar'),
        },
        { label: 'Files', click: () => send('view.files') },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send('view.search'),
        },
        {
          label: 'Outline',
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () => send('view.outline'),
        },
        {
          label: 'History',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: () => send('view.history'),
        },
        { type: 'separator' },
        {
          label: 'Source Mode',
          accelerator: 'CmdOrCtrl+/',
          click: () => send('view.sourceMode'),
        },
        { label: 'Focus Mode', accelerator: 'F8', click: () => send('view.focusMode') },
        {
          label: 'Typewriter Mode',
          accelerator: 'F9',
          click: () => send('view.typewriterMode'),
        },
        { label: 'Toggle Light / Dark', click: () => send('view.colorMode') },
        { type: 'separator' },
        {
          label: 'Settings…',
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
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'F1',
          click: () => send('help.shortcuts'),
        },
        { label: 'About NotaDown', click: () => send('help.about') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
