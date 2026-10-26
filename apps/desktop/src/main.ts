import {
  DESKTOP_ASSET_SCHEME,
  DESKTOP_OPEN_FILES_CHANNEL,
  DESKTOP_TITLE_BAR_ARG,
} from '@notadown/shared'
import { app, BrowserWindow, nativeTheme, net, protocol, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getWindowChrome, resolveWindowChrome, TITLE_BAR_OVERLAY_HEIGHT } from './chrome'
import { stopAllFileWatches } from './document-watch'
import { registerIpcHandlers } from './ipc'
import { installMenu } from './menu'
import { resolveMenuLocale } from './menu-labels'
import { queueOpenFiles } from './open-files'
import { loadSettings } from './state'
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
const WINDOW_ICON = path.join(
  __dirname,
  process.platform === 'win32' ? 'icon.ico' : 'icon.png',
)

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const chrome = getWindowChrome()
  const integrated = chrome.titleBarMode === 'integrated'
  const frameOptions = integrated
    ? isMac
      ? { titleBarStyle: 'hiddenInset' as const }
      : {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: chrome.overlay.color,
            symbolColor: chrome.overlay.symbolColor,
            height: TITLE_BAR_OVERLAY_HEIGHT,
          },
        }
    : {}

  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    icon: WINDOW_ICON,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1d21' : '#ffffff',
    autoHideMenuBar: integrated && !isMac,
    ...frameOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`${DESKTOP_TITLE_BAR_ARG}${chrome.titleBarMode}`],
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

function focusWindow(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
}

function notifyOpenFiles(): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) return
  window.webContents.send(DESKTOP_OPEN_FILES_CHANNEL)
}

const hasLock = app.requestSingleInstanceLock()

if (!hasLock) {
  app.quit()
} else {
  queueOpenFiles(process.argv.slice(1))

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    queueOpenFiles([filePath])
    notifyOpenFiles()
  })

  app.on('second-instance', (_event, argv, workingDirectory) => {
    queueOpenFiles(argv.slice(1), workingDirectory)
    focusWindow()
    notifyOpenFiles()
  })

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.notadown.app')
    await resolveWindowChrome()

    protocol.handle(DESKTOP_ASSET_SCHEME, (request) => {
      const filePath = assetFilePath(request.url)
      if (!filePath) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(filePath).toString())
    })

    const menuTarget = () => BrowserWindow.getAllWindows()[0] ?? null
    const settings = await loadSettings()
    let menuLocale = resolveMenuLocale(settings?.locale, app.getLocale())
    installMenu(menuTarget, menuLocale)
    registerIpcHandlers((next) => {
      const locale = resolveMenuLocale(next.locale, app.getLocale())
      if (locale === menuLocale) return
      menuLocale = locale
      installMenu(menuTarget, locale)
    })
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    stopWatch()
    stopAllFileWatches()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
