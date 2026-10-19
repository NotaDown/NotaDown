import { describe, expect, it, vi } from 'vitest'
import { renderMarkdown, renderStandaloneHtml } from '../src'
import type { ExportDocumentOptions } from '../src'

vi.mock('mermaid', () => ({
  default: {
    initialize: () => undefined,
    render: async () => ({ svg: '<svg class="fake-mermaid"></svg>' }),
  },
}))

const base: ExportDocumentOptions = {
  title: 'Test document',
  theme: 'default',
  mode: 'light',
}

describe('renderMarkdown', () => {
  it('renders headings, emphasis, tables, task lists and highlighted code', async () => {
    const html = await renderMarkdown(
      [
        '# Title',
        '',
        'Some **bold** and `inline` text.',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '- [x] done',
        '- [ ] todo',
        '',
        '```js',
        'const answer = 42',
        '```',
      ].join('\n'),
      base,
    )

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>inline</code>')
    expect(html).toContain('<table>')
    expect(html).toContain('contains-task-list')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('language-js')
  })

  it('renders inline and block math through KaTeX', async () => {
    const html = await renderMarkdown(
      [
        'Inline $a^2 + b^2 = c^2$ math.',
        '',
        '$$',
        '\\int_0^1 x^2 \\, dx',
        '$$',
      ].join('\n'),
      base,
    )

    expect(html).toContain('class="katex"')
    expect(html).toContain('katex-display')
  })

  it('renders mermaid fences through the async renderer', async () => {
    const html = await renderMarkdown('```mermaid\ngraph TD\nA --> B\n```', base)
    expect(html).toContain('class="nd-mermaid"')
    expect(html).toContain('class="fake-mermaid"')
    expect(html).not.toContain('graph TD')
  })

  it('replaces local image sources with resolved data URLs', async () => {
    const html = await renderMarkdown('![diagram](assets/pic.png)\n\n![remote](https://example.com/a.png)', {
      ...base,
      resolveImage: async (src) =>
        src === 'assets/pic.png' ? 'data:image/png;base64,AAAA' : null,
    })

    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('src="https://example.com/a.png"')
  })

  it('opens external links in a new tab', async () => {
    const html = await renderMarkdown('[site](https://example.com)', base)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe('renderStandaloneHtml', () => {
  it('wraps the document with theme variables and an escaped title', async () => {
    const html = await renderStandaloneHtml('# Hi', {
      ...base,
      title: '<Test> & "quoted"',
    })

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>&lt;Test&gt; &amp; &quot;quoted&quot;</title>')
    expect(html).toContain('--nd-bg:')
    expect(html).toContain('class="nd-export"')
    expect(html).toContain('<h1>Hi</h1>')
  })
})
