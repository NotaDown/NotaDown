/// <reference path="./shims.d.ts" />
import { isRemoteOrDataUrl } from '@notadown/shared'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import MarkdownIt, {
  type StateBlock,
  type StateCore,
  type StateInline,
  type Token,
} from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import type { ExportDocumentOptions } from './types'

type MermaidApi = (typeof import('mermaid'))['default']

let mermaidPromise: Promise<MermaidApi> | null = null
let mermaidCounter = 0

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default)
  return mermaidPromise
}

export async function renderMarkdown(
  source: string,
  options: ExportDocumentOptions,
): Promise<string> {
  const mermaidBlocks: string[] = []
  const imageSources: string[] = []
  const marker = `nd-export-image-${Math.random().toString(36).slice(2, 10)}`
  const md = createMarkdown(marker, imageSources, mermaidBlocks)

  let html = md.render(source)
  html = await renderMermaidBlocks(html, mermaidBlocks, options.mode)

  if (options.resolveImage) {
    for (let index = 0; index < imageSources.length; index += 1) {
      let resolved: string | null = null
      try {
        resolved = await options.resolveImage(imageSources[index])
      } catch {
        resolved = null
      }
      if (!resolved) continue
      html = html.split(`${marker}-${index}`).join(escapeAttribute(resolved))
    }
  }

  return html
}

type MarkdownItInstance = InstanceType<typeof MarkdownIt>

function createMarkdown(
  marker: string,
  imageSources: string[],
  mermaidBlocks: string[],
): MarkdownItInstance {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  })

  taskLists(md, { enabled: false, label: true, labelAfter: true })

  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.math_inline = (tokens, idx) => renderMath(tokens[idx].content, false)
  md.renderer.rules.math_block = (tokens, idx) => `${renderMath(tokens[idx].content, true)}\n`

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const language = token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    if (language === 'mermaid' || language === 'mmd') {
      const index = mermaidBlocks.push(token.content) - 1
      return `<div class="nd-mermaid" data-nd-mermaid="${index}"></div>\n`
    }
    return renderCodeBlock(token, language)
  }

  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const href = String(tokens[idx].attrGet('href') ?? '')
    if (/^https?:/i.test(href)) {
      tokens[idx].attrSet('target', '_blank')
      tokens[idx].attrSet('rel', 'noopener noreferrer')
    }
    return self.renderToken(tokens, idx, options)
  }

  md.core.ruler.push('nd_export_images', (state: StateCore) => {
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue
      for (const child of token.children) {
        if (child.type !== 'image') continue
        const src = String(child.attrGet('src') ?? '')
        if (!src || isRemoteOrDataUrl(src) || src.startsWith('#')) continue
        const index = imageSources.push(src) - 1
        child.attrSet('src', `${marker}-${index}`)
      }
    }
  })

  return md
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const source = state.src
  if (source.charCodeAt(start) !== 0x24) return false

  const first = source[start + 1]
  if (!first || first === '$' || /\s/.test(first)) return false

  let searchFrom = start + 1
  let closing = -1
  while (searchFrom < source.length) {
    const index = source.indexOf('$', searchFrom)
    if (index === -1) break
    const before = source[index - 1]
    const after = source[index + 1]
    if (before === '\\' || /\s/.test(before) || (after && /[0-9]/.test(after))) {
      searchFrom = index + 1
      continue
    }
    closing = index
    break
  }
  if (closing === -1) return false

  const content = source.slice(start + 1, closing)
  if (!content.trim()) return false
  if (silent) return true

  state.pos = closing + 1
  const token = state.push('math_inline', 'math', 0)
  token.content = content
  token.markup = '$'
  return true
}

function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (start + 2 > max) return false
  if (state.src.slice(start, start + 2) !== '$$') return false

  let content = ''
  let nextLine = startLine + 1
  const firstLine = state.src.slice(start + 2, max).trim()

  if (firstLine.endsWith('$$')) {
    content = firstLine.slice(0, -2).trim()
    if (!content) return false
  } else {
    if (firstLine) content = `${firstLine}\n`
    let closing = -1
    for (let line = startLine + 1; line < endLine; line += 1) {
      const lineStart = state.bMarks[line] + state.tShift[line]
      const lineEnd = state.eMarks[line]
      const text = state.src.slice(lineStart, lineEnd)
      if (text.trim() === '$$') {
        closing = line
        break
      }
      content += `${text}\n`
    }
    if (closing === -1) return false
    nextLine = closing + 1
  }

  if (silent) return true

  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content.trim()
  token.markup = '$$'
  token.map = [startLine, nextLine]
  state.line = nextLine
  return true
}

function renderMath(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    })
  } catch {
    return `<code class="nd-math-error">${escapeHtml(source)}</code>`
  }
}

function renderCodeBlock(token: Token, language: string): string {
  let body: string
  if (language && hljs.getLanguage(language)) {
    try {
      body = hljs.highlight(token.content, {
        language,
        ignoreIllegals: true,
      }).value
    } catch {
      body = escapeHtml(token.content)
    }
  } else {
    body = escapeHtml(token.content)
  }
  const languageClass = language ? ` class="language-${escapeAttribute(language)}"` : ''
  return `<pre class="hljs"><code${languageClass}>${body}</code></pre>\n`
}

async function renderMermaidBlocks(
  html: string,
  blocks: string[],
  mode: 'light' | 'dark',
): Promise<string> {
  if (!blocks.length) return html

  let mermaid: MermaidApi
  try {
    mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: mode === 'dark' ? 'dark' : 'default',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans SC", sans-serif',
      flowchart: { useMaxWidth: true },
      sequence: { useMaxWidth: true },
      gantt: { useMaxWidth: true },
    })
  } catch {
    return html
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const placeholder = `<div class="nd-mermaid" data-nd-mermaid="${index}"></div>`
    let replacement: string
    try {
      const result = await mermaid.render(`notadown-export-${++mermaidCounter}`, blocks[index])
      replacement = `<div class="nd-mermaid">${result.svg}</div>`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      replacement = `<div class="nd-mermaid-error"><strong>${escapeHtml(message)}</strong><pre><code>${escapeHtml(blocks[index])}</code></pre></div>`
    }
    html = html.split(placeholder).join(replacement)
  }
  return html
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
