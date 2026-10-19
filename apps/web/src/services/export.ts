import {
  dirname,
  isRemoteOrDataUrl,
  joinPosix,
  normalizeSlashes,
  stripExtension,
  type AssetReadResult,
} from '@notadown/shared'
import { renderStandaloneHtml } from '@notadown/exporter'
import type { AssetTarget } from '@notadown/platform'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import type { EditorTab } from '@/stores/tabs'

export async function exportTabDocument(
  tab: EditorTab,
  format: 'html' | 'pdf',
): Promise<boolean> {
  const settings = useSettingsStore()
  const html = await renderStandaloneHtml(tab.content, {
    title: tab.name,
    theme: settings.settings.theme,
    mode: settings.effectiveMode,
    lang: document.documentElement.lang || undefined,
    resolveImage: (src) => resolveImageSource(src, tab),
  })

  const base = stripExtension(tab.name) || 'Untitled'
  const fileName = `${base}.${format}`
  return format === 'pdf'
    ? platform.exportPdf(html, fileName)
    : platform.exportHtml(html, fileName)
}

async function resolveImageSource(src: string, tab: EditorTab): Promise<string | null> {
  if (!src || isRemoteOrDataUrl(src) || src.startsWith('#')) return null

  let clean = src.split('#')[0].split('?')[0]
  try {
    clean = decodeURI(clean)
  } catch {
    // Keep the original string when it is not valid percent-encoding.
  }
  clean = clean.replace(/^\.\/+/, '')
  if (!clean) return null

  let target: AssetTarget | null = null
  if (tab.ref.origin === 'workspace' && tab.ref.path) {
    target = {
      scope: 'workspace',
      path: joinPosix(dirname(tab.ref.path), clean),
    }
  } else if (tab.ref.origin === 'file' && tab.ref.path && platform.kind === 'desktop') {
    const documentDir = dirname(normalizeSlashes(tab.ref.path))
    const absolute = /^([a-zA-Z]:[\\/]|\/)/.test(clean)
      ? clean
      : joinAbsolute(documentDir, clean)
    target = { scope: 'absolute', path: absolute }
  }

  if (!target) return null

  try {
    const asset = await platform.readAsset(target)
    return asset ? assetToDataUrl(asset) : null
  } catch {
    return null
  }
}

function assetToDataUrl(asset: AssetReadResult): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < asset.data.length; offset += chunkSize) {
    binary += String.fromCharCode(...asset.data.subarray(offset, offset + chunkSize))
  }
  return `data:${asset.mime};base64,${btoa(binary)}`
}

function joinAbsolute(base: string, relative: string): string {
  const cleanBase = base.replace(/[\\/]+$/, '')
  const normalizedRelative = normalizeSlashes(relative).replace(/^\/+/, '')
  if (cleanBase.includes('\\')) return `${cleanBase}\\${normalizedRelative.replace(/\//g, '\\')}`
  return `${cleanBase}/${normalizedRelative}`
}
