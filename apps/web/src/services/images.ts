import {
  buildImageFileName,
  dirname,
  extensionFromMime,
  extensionOf,
  isImageFile,
  isRemoteOrDataUrl,
  joinPosix,
  mimeFromFileName,
  normalizeSlashes,
  relativePosix,
  resolveDocumentPath,
  type AppSettings,
  type ImageStorageMode,
} from '@notadown/shared'
import type { EditorImage } from '@notadown/editor'
import { platform } from '@/platform'
import { useSettingsStore } from '@/stores/settings'
import type { EditorTab } from '@/stores/tabs'

export async function saveTabImage(file: File, tab: EditorTab): Promise<EditorImage> {
  if (!isImageFile(file.name) && !file.type.startsWith('image/')) {
    throw new Error('UNSUPPORTED_IMAGE')
  }
  const settings = useSettingsStore().settings
  const mime = file.type || mimeFromFileName(file.name)
  const extension = extensionOf(file.name) || extensionFromMime(mime)
  const originalName = file.name || `image.${extension}`
  const fileName = imageFileName(settings.imageFileNamePattern, settings.imageStorage, {
    documentName: tab.ref.name,
    originalName,
    extension,
  })
  const data = new Uint8Array(await file.arrayBuffer())

  if (settings.imageStorage === 'base64' || !canWriteAssets(tab)) {
    const src = await readAsDataUrl(file, mime)
    return { src, displayUrl: src }
  }

  if (tab.ref.origin === 'workspace' && tab.ref.path) {
    const documentDir = dirname(tab.ref.path)
    const directory = assetDirectory(settings, documentDir, true)
    const path = joinPosix(directory, fileName)
    await platform.writeAsset({ scope: 'workspace', path }, data, mime)
    return {
      src: relativePosix(documentDir, path),
      displayUrl: await platform.getAssetUrl({ scope: 'workspace', path }),
    }
  }

  if (tab.ref.origin === 'file' && tab.ref.path && platform.kind === 'desktop') {
    const documentDir = dirname(normalizeSlashes(tab.ref.path))
    const directory = assetDirectory(settings, documentDir, false)
    const imagePath = joinPosix(directory, fileName)
    const absolute = joinAbsolute(documentDir, imagePath.replace(/^\.\/+/, ''))
    await platform.writeAsset({ scope: 'absolute', path: absolute }, data, mime)
    return {
      src: relativePosix(documentDir, imagePath),
      displayUrl: await platform.getAssetUrl({ scope: 'absolute', path: absolute }),
    }
  }

  const src = await readAsDataUrl(file, mime)
  return { src, displayUrl: src }
}

export async function resolveEditorImageUrl(src: string, tab: EditorTab): Promise<string> {
  if (!src || isRemoteOrDataUrl(src)) return src
  if (src.startsWith('#')) return src

  let clean = src.split('#')[0].split('?')[0]
  try {
    clean = decodeURIComponent(clean)
  } catch {
    // Keep the original string when it is not valid percent-encoding.
  }
  clean = clean.replace(/^\.\/+/, '')

  if (tab.ref.origin === 'workspace' && tab.ref.path) {
    try {
      const path = joinPosix(dirname(tab.ref.path), clean)
      return await platform.getAssetUrl({ scope: 'workspace', path })
    } catch {
      return src
    }
  }

  if (tab.ref.origin === 'file' && tab.ref.path && platform.kind === 'desktop') {
    try {
      const documentDir = dirname(normalizeSlashes(tab.ref.path))
      const path = resolveDocumentPath(documentDir, clean)
      return await platform.getAssetUrl({ scope: 'absolute', path })
    } catch {
      return src
    }
  }

  return src
}

function canWriteAssets(tab: EditorTab): boolean {
  if (tab.ref.origin === 'workspace') return tab.ref.path !== null
  if (tab.ref.origin === 'file') return platform.kind === 'desktop' && tab.ref.path !== null
  return false
}

function assetDirectory(
  settings: AppSettings,
  documentDir: string,
  inWorkspace: boolean,
): string {
  switch (settings.imageStorage) {
    case 'document-named':
      return documentDir
    case 'global-attachments':
      return inWorkspace ? settings.globalAttachmentsDir : joinPosix(documentDir, settings.documentAssetsDir)
    case 'document-assets':
    default:
      return joinPosix(documentDir, settings.documentAssetsDir)
  }
}

function imageFileName(
  pattern: string,
  mode: ImageStorageMode,
  context: { documentName: string; originalName: string; extension: string },
): string {
  const effective =
    mode === 'document-named' && !pattern.includes('${documentName}')
      ? `${context.documentName ? '${documentName}-' : ''}${pattern}`
      : pattern
  return buildImageFileName(effective, { ...context, index: 1 })
}

function joinAbsolute(base: string, relative: string): string {
  const cleanBase = base.replace(/[\\/]+$/, '')
  const normalizedRelative = normalizeSlashes(relative).replace(/^\/+/, '')
  if (cleanBase.includes('\\')) return `${cleanBase}\\${normalizedRelative.replace(/\//g, '\\')}`
  return `${cleanBase}/${normalizedRelative}`
}

function readAsDataUrl(file: File, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'))
    reader.readAsDataURL(new Blob([file], { type: mime }))
  })
}
