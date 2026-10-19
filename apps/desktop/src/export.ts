import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { currentRoot } from './workspace'

export async function exportHtml(
  window: BrowserWindow | null,
  html: string,
  suggestedName: string,
): Promise<boolean> {
  const target = await chooseTarget(window, suggestedName, 'html', 'HTML document')
  if (!target) return false
  await fs.writeFile(target, html, 'utf8')
  return true
}

export async function exportPdf(
  window: BrowserWindow | null,
  html: string,
  suggestedName: string,
): Promise<boolean> {
  const target = await chooseTarget(window, suggestedName, 'pdf', 'PDF document')
  if (!target) return false

  const tempDir = await fs.mkdtemp(path.join(app.getPath('temp'), 'notadown-export-'))
  const tempFile = path.join(tempDir, 'document.html')
  await fs.writeFile(tempFile, html, 'utf8')

  const printWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  try {
    await printWindow.loadFile(tempFile)
    try {
      await printWindow.webContents.executeJavaScript(
        'document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true',
      )
    } catch {
      // Rendering can proceed even if the font readiness probe fails.
    }
    const buffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: false,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })
    await fs.writeFile(target, buffer)
    return true
  } finally {
    printWindow.destroy()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function chooseTarget(
  window: BrowserWindow | null,
  suggestedName: string,
  extension: string,
  filterName: string,
): Promise<string | null> {
  const directory = currentRoot() ?? app.getPath('documents')
  const options = {
    defaultPath: path.join(directory, ensureExtension(suggestedName, extension)),
    filters: [{ name: filterName, extensions: [extension] }],
  }
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}

function ensureExtension(name: string, extension: string): string {
  const trimmed = name.trim() || `Untitled.${extension}`
  if (trimmed.toLowerCase().endsWith(`.${extension}`)) return trimmed
  return `${trimmed.replace(/\.[^./\\]+$/, '')}.${extension}`
}
