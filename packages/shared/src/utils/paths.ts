import type { DocumentRef } from '../types'

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'txt'])

export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/')
}

export function extensionOf(fileName: string): string {
  const clean = normalizeSlashes(fileName).split('/').pop() ?? ''
  const index = clean.lastIndexOf('.')
  if (index <= 0) return ''
  return clean.slice(index + 1).toLowerCase()
}

export function isMarkdownFile(fileName: string): boolean {
  return extensionOf(fileName) === 'md' || extensionOf(fileName) === 'markdown'
}

export function isOpenableTextFile(fileName: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extensionOf(fileName))
}

export function openableFileArgs(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith('-') && isOpenableTextFile(arg))
}

export function basename(path: string): string {
  const clean = normalizeSlashes(path).replace(/\/+$/, '')
  const index = clean.lastIndexOf('/')
  return index === -1 ? clean : clean.slice(index + 1)
}

export function fileDocumentRef(absolutePath: string): DocumentRef {
  return {
    key: `file:${absolutePath}`,
    name: basename(absolutePath),
    path: absolutePath,
    origin: 'file',
  }
}

export function dirname(path: string): string {
  const clean = normalizeSlashes(path).replace(/\/+$/, '')
  const index = clean.lastIndexOf('/')
  if (index === -1) return ''
  if (index === 0) return '/'
  return clean.slice(0, index)
}

export function joinPosix(...parts: string[]): string {
  const segments: string[] = []
  for (const part of parts) {
    for (const segment of normalizeSlashes(part).split('/')) {
      if (!segment || segment === '.') continue
      if (segment === '..') {
        if (segments.length && segments[segments.length - 1] !== '..') {
          segments.pop()
        } else {
          segments.push('..')
        }
        continue
      }
      segments.push(segment)
    }
  }
  return segments.join('/')
}

export function isAbsoluteFilePath(value: string): boolean {
  const clean = normalizeSlashes(value)
  return /^[a-zA-Z]:\//.test(clean) || clean.startsWith('//') || clean.startsWith('/')
}

export function resolveFilePath(baseDir: string, targetPath: string): string {
  const target = normalizeSlashes(targetPath)
  if (isAbsoluteFilePath(target)) return normalizeAbsolutePath(target)
  const base = normalizeSlashes(baseDir)
  const joined = joinPosix(base, target)
  if (base.startsWith('//')) return `//${joined}`
  if (base.startsWith('/') && !joined.startsWith('/')) return `/${joined}`
  return joined
}

export function resolveDocumentPath(documentDir: string, targetPath: string): string {
  const dir = normalizeSlashes(documentDir)
  const target = normalizeSlashes(targetPath)
  const windows = /^[a-zA-Z]:\//.test(dir) || dir.startsWith('//')
  const relativeTarget =
    windows && target.startsWith('/') && !target.startsWith('//')
      ? target.replace(/^\/+/, '')
      : target
  return resolveFilePath(dir, relativeTarget)
}

function normalizeAbsolutePath(value: string): string {
  const drive = /^[a-zA-Z]:/.exec(value)?.[0] ?? ''
  const unc = drive ? '' : /^\/\/[^/]+\/[^/]+/.exec(value)?.[0] ?? ''
  const prefix = drive || unc || (value.startsWith('/') ? '/' : '')
  const rest = value.slice(prefix.length)
  const joined = joinPosix(rest)
  if (!joined) return drive ? `${drive}/` : prefix || '.'
  return prefix.endsWith('/') ? `${prefix}${joined}` : `${prefix}/${joined}`
}

export function relativePosix(fromDir: string, toPath: string): string {
  const from = normalizeSlashes(fromDir)
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
  const to = normalizeSlashes(toPath)
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)

  let common = 0
  while (common < from.length && common < to.length && from[common] === to[common]) {
    common += 1
  }

  const up = new Array(from.length - common).fill('..')
  const down = to.slice(common)
  const result = [...up, ...down].join('/')
  return result || '.'
}

export function ensureMarkdownExtension(name: string, extension = 'md'): string {
  const trimmed = name.trim()
  if (!trimmed) return `Untitled.${extension}`
  if (/\.[a-zA-Z0-9]{1,8}$/.test(trimmed)) return trimmed
  return `${trimmed}.${extension}`
}

export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^\.+$/, '-')
    .slice(0, 180)
}

export function stripExtension(fileName: string): string {
  const base = basename(fileName)
  const index = base.lastIndexOf('.')
  if (index <= 0) return base
  return base.slice(0, index)
}

export function parentDirectoryOfFile(filePath: string): string {
  return dirname(filePath)
}

export function isHiddenPath(path: string): boolean {
  return normalizeSlashes(path)
    .split('/')
    .some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')
}
