import { app, type BrowserWindow } from 'electron'

const closeAllowed = new WeakSet<BrowserWindow>()
let quitAllowed = false

export function isWindowCloseAllowed(window: BrowserWindow): boolean {
  return closeAllowed.has(window)
}

export function allowWindowClose(window: BrowserWindow): void {
  closeAllowed.add(window)
}

export function allowAppQuit(): void {
  quitAllowed = true
}

export function isAppQuitAllowed(): boolean {
  return quitAllowed
}

export function confirmWindowClose(window: BrowserWindow, quit: boolean): void {
  closeAllowed.add(window)
  if (quit) {
    quitAllowed = true
    app.quit()
    return
  }
  window.close()
}
