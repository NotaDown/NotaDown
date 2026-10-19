import { DESKTOP_ASSET_SCHEME } from '@notadown/shared'
import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpcHandlers } from './ipc'
import { installMenu } from './menu'
import { stopWatch } from './workspace'

app.setName('NotaDown')

protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
])

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_INDEX = path.join(__dirname, '../renderer/index.html')
const RENDERER_URL = pathToFileURL(RENDERER_INDEX).toString()

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1d21' : '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL)) return
    if (!DEV_SERVER_URL && url.startsWith(RENDERER_URL)) return
    event.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL)
  } else {
    void window.loadFile(RENDERER_INDEX)
  }

  return window
}

function assetFilePath(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    if (url.host !== 'local') return null
    let filePath = decodeURIComponent(url.pathname)
    if (/^\/[A-Za-z]:[\\/]/.test(filePath)) {
      filePath = filePath.slice(1)
    } else if (filePath.startsWith('//')) {
      filePath = filePath.slice(1)
    }
    return path.isAbsolute(filePath) ? filePath : null
  } catch {
    return null
  }
}

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('com.notadown.app')

    protocol.handle(DESKTOP_ASSET_SCHEME, (request) => {
      const filePath = assetFilePath(request.url)
      if (!filePath) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(filePath).toString())
    })

    registerIpcHandlers()
    installMenu(() => BrowserWindow.getAllWindows()[0] ?? null)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => stopWatch())

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
