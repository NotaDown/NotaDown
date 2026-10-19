import { renderMarkdown } from './markdown'
import { buildDocumentCss } from './styles'
import type { ExportDocumentOptions } from './types'

export type { ExportDocumentOptions } from './types'
export { renderMarkdown }

export async function renderStandaloneHtml(
  markdown: string,
  options: ExportDocumentOptions,
): Promise<string> {
  return buildHtmlDocument(await renderMarkdown(markdown, options), options)
}

export function buildHtmlDocument(body: string, options: ExportDocumentOptions): string {
  const title = options.title.trim() || 'Untitled'
  const lang = options.lang?.trim() || 'en'
  return `<!doctype html>
<html lang="${escapeAttribute(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${buildDocumentCss(options.theme, options.mode)}
</style>
</head>
<body>
<article class="nd-export">
${body}
</article>
</body>
</html>
`
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
