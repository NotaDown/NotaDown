export interface SplitFrontmatterResult {
  frontmatter: string | null
  body: string
}

const FRONTMATTER_START = /^---[ \t]*\r?\n/

export function splitFrontmatter(markdown: string): SplitFrontmatterResult {
  const match = FRONTMATTER_START.exec(markdown)
  if (!match) return { frontmatter: null, body: markdown }

  const rest = markdown.slice(match[0].length)
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m
  const closingMatch = closing.exec(rest)
  if (!closingMatch) return { frontmatter: null, body: markdown }

  const end = match[0].length + closingMatch.index + closingMatch[0].length
  return {
    frontmatter: markdown.slice(0, end),
    body: markdown.slice(end),
  }
}

export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (!frontmatter) return body
  if (!frontmatter.endsWith('\n')) return `${frontmatter}\n${body}`
  return `${frontmatter}${body}`
}

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

export function countWords(markdown: string): { words: number; characters: number } {
  const { body } = splitFrontmatter(markdown)
  const withoutCodeFences = body.replace(/^```.*$/gm, ' ')
  const cjkMatches = withoutCodeFences.match(
    /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g,
  )
  const latinMatches = withoutCodeFences.match(
    /[A-Za-z0-9\u00c0-\u024f]+(?:['’\-][A-Za-z0-9\u00c0-\u024f]+)*/g,
  )
  const words = (cjkMatches?.length ?? 0) + (latinMatches?.length ?? 0)
  return { words, characters: Array.from(body).length }
}

export function extractHeadings(markdown: string): Array<{ level: number; text: string; line: number }> {
  const { frontmatter } = splitFrontmatter(markdown)
  const offset = frontmatter ? frontmatter.split('\n').length - 1 : 0
  const result: Array<{ level: number; text: string; line: number }> = []
  markdown.split(/\r?\n/).forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      result.push({
        level: match[1].length,
        text: match[2].replace(/[*_`~]/g, ''),
        line: index + 1 - offset,
      })
    }
  })
  return result
}

export function createSearchPreview(content: string, index: number, length: number): {
  line: number
  preview: string
  matchStart: number
  matchLength: number
} {
  const before = content.slice(0, index)
  const line = before.split('\n').length
  const lineStart = before.lastIndexOf('\n') + 1
  let lineEnd = content.indexOf('\n', index)
  if (lineEnd === -1) lineEnd = content.length

  const fullLine = content.slice(lineStart, lineEnd)
  const maxLength = 180
  let preview = fullLine
  let matchStart = index - lineStart

  if (preview.length > maxLength) {
    const contextBefore = Math.max(0, matchStart - 60)
    preview = fullLine.slice(contextBefore, contextBefore + maxLength)
    matchStart -= contextBefore
    if (contextBefore > 0) {
      preview = `…${preview}`
      matchStart += 1
    }
    if (contextBefore + maxLength < fullLine.length) preview = `${preview}…`
  }

  return {
    line,
    preview: preview.replace(/\t/g, ' '),
    matchStart: Math.max(0, Math.min(matchStart, preview.length)),
    matchLength: Math.min(length, preview.length - Math.max(0, matchStart)),
  }
}

export function stripMarkdownSyntax(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
