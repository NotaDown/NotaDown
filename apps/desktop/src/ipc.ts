import { app, BrowserWindow, ipcMain, shell } from 'electron'
import {
  DESKTOP_INVOKE_CHANNEL,
  type AppSettings,
  type HistoryOptions,
  type HistorySnapshotInput,
  type SearchOptions,
  type SessionState,
} from '@notadown/shared'
import { getWindowChrome, updateOverlayColors } from './chrome'
import { exportHtml, exportPdf } from './export'
import { normalizeError } from './errors'
import * as history from './history'
import { takeOpenFiles } from './open-files'
import * as state from './state'
import * as workspace from './workspace'

export function registerIpcHandlers(): void {
  ipcMain.handle(
    DESKTOP_INVOKE_CHANNEL,
    async (event, method: string, ...args: unknown[]): Promise<unknown> => {
      const window = BrowserWindow.fromWebContents(event.sender)
      try {
        return await dispatch(method, window, args)
      } catch (error) {
        throw normalizeError(error)
      }
    },
  )
}

async function dispatch(
  method: string,
  window: BrowserWindow | null,
  args: unknown[],
): Promise<unknown> {
  switch (method) {
    case 'getVersion':
      return app.getVersion()
    case 'getPlatform':
      return process.platform

    case 'openWorkspace':
      return workspace.openWorkspace(window)
    case 'restoreWorkspace':
      return workspace.restoreWorkspace(String(args[0] ?? ''))
    case 'closeWorkspace':
      workspace.closeWorkspace()
      return undefined
    case 'listWorkspace':
      return workspace.listWorkspace()
    case 'readWorkspaceFile':
      return workspace.readWorkspaceFile(String(args[0] ?? ''))
    case 'writeWorkspaceFile':
      return workspace.writeWorkspaceFile(String(args[0] ?? ''), String(args[1] ?? ''))
    case 'createWorkspaceFile':
      await workspace.createWorkspaceFile(String(args[0] ?? ''), String(args[1] ?? ''))
      return undefined
    case 'createWorkspaceDirectory':
      await workspace.createWorkspaceDirectory(String(args[0] ?? ''))
      return undefined
    case 'renameWorkspaceEntry':
      await workspace.renameWorkspaceEntry(
        String(args[0] ?? ''),
        String(args[1] ?? ''),
      )
      return undefined
    case 'moveWorkspaceEntry':
      await workspace.moveWorkspaceEntry(String(args[0] ?? ''), String(args[1] ?? ''))
      return undefined
    case 'deleteWorkspaceEntry':
      await workspace.deleteWorkspaceEntry(String(args[0] ?? ''))
      return undefined
    case 'revealWorkspaceEntry':
      await workspace.revealWorkspaceEntry(String(args[0] ?? ''))
      return undefined

    case 'openFileDialog':
      return workspace.openFileDialog(window)
    case 'readFile':
      return workspace.readAbsoluteFile(String(args[0] ?? ''))
    case 'writeFile':
      return workspace.writeAbsoluteFile(String(args[0] ?? ''), String(args[1] ?? ''))
    case 'saveFileDialog':
      return workspace.saveFileDialog(
        window,
        String(args[0] ?? ''),
        String(args[1] ?? ''),
        typeof args[2] === 'string' ? args[2] : null,
      )
    case 'statFile':
      return workspace.statFile(String(args[0] ?? ''))

    case 'writeImageFile':
      return workspace.writeImageFile(
        String(args[0] ?? ''),
        args[1] as Uint8Array,
        String(args[2] ?? ''),
      )
    case 'readAsset':
      return workspace.readAsset(String(args[0] ?? ''))

    case 'searchWorkspace':
      return workspace.searchWorkspace(
        String(args[0] ?? ''),
        args[1] as SearchOptions | undefined,
      )
    case 'startWatch':
      if (!window) throw new Error('NO_WINDOW')
      workspace.startWatch(window)
      return undefined

    case 'historySnapshot':
      return history.saveHistory(
        args[0] as HistorySnapshotInput,
        args[1] as HistoryOptions,
      )
    case 'historyList':
      return history.listHistory(typeof args[0] === 'string' ? args[0] : undefined)
    case 'historyRead':
      return history.readHistory(String(args[0] ?? ''))
    case 'historyDelete':
      await history.deleteHistory(String(args[0] ?? ''))
      return undefined
    case 'historyClear':
      await history.clearHistory()
      return undefined

    case 'loadSettings':
      return state.loadSettings()
    case 'saveSettings':
      await state.saveSettings(args[0] as AppSettings)
      return undefined
    case 'loadSession':
      return state.loadSession()
    case 'saveSession':
      await state.saveSession(args[0] as SessionState)
      return undefined

    case 'exportHtml':
      return exportHtml(window, String(args[0] ?? ''), String(args[1] ?? ''))
    case 'exportPdf':
      return exportPdf(window, String(args[0] ?? ''), String(args[1] ?? ''))

    case 'getTitleBarMode':
      return getWindowChrome().titleBarMode
    case 'setTitleBarOverlay': {
      const color = String(args[0] ?? '')
      const symbolColor = String(args[1] ?? '')
      updateOverlayColors(color, symbolColor)
      if (
        window &&
        process.platform !== 'darwin' &&
        getWindowChrome().titleBarMode === 'integrated'
      ) {
        try {
          window.setTitleBarOverlay({ color, symbolColor, height: 44 })
        } catch {
          // The window may use a native title bar on unsupported platforms.
        }
      }
      return undefined
    }

    case 'openExternal': {
      const url = String(args[0] ?? '')
      if (!/^(https?:|mailto:)/i.test(url)) throw new Error('UNSUPPORTED')
      await shell.openExternal(url)
      return undefined
    }

    case 'takeOpenFiles':
      return takeOpenFiles()

    default:
      throw new Error('UNSUPPORTED')
  }
}
