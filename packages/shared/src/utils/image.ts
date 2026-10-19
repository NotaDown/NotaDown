import { extensionOf, stripExtension } from './paths'

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(fileName))
}

export function mimeFromFileName(fileName: string): string {
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? 'application/octet-stream'
}

export function extensionFromMime(mime: string): string {
  const entry = Object.entries(MIME_BY_EXTENSION).find(([, value]) => value === mime)
  return entry?.[0] ?? 'png'
}

export interface ImageNameContext {
  documentName: string
  originalName: string
  extension: string
  index?: number
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function timestampForFileName(date = new Date()): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function randomToken(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const values = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values)
  } else {
    for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

export function buildImageFileName(pattern: string, context: ImageNameContext, date = new Date()): string {
  const originalBase = stripExtension(context.originalName)
  const values: Record<string, string> = {
    documentName: stripExtension(context.documentName),
    originalName: originalBase,
    timestamp: timestampForFileName(date),
    date: `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    time: `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
    random: randomToken(),
    index: String(context.index ?? 1),
  }

  let base = pattern.replace(/\$\{([a-zA-Z]+)\}/g, (match, token: string) => {
    return values[token] ?? match
  })
  base = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^\.+$/, '')
    .slice(0, 160)
  if (!base) base = `image-${values.timestamp}-${values.random}`

  const extension = context.extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png'
  return `${base}.${extension}`
}

export function isRemoteOrDataUrl(src: string): boolean {
  return /^(?:https?:|data:|blob:|notadown-asset:)/i.test(src)
}
