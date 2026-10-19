import { describe, expect, it } from 'vitest'
import { transformHtmlBlocks } from '../src/html'
import { isBlockHtml } from '../src/html/sanitize'

function node(type: string, value?: string, children?: unknown[]): Record<string, unknown> {
  return { type, value, children }
}

function root(children: unknown[]): Record<string, unknown> {
  return node('root', undefined, children)
}

describe('isBlockHtml', () => {
  it('recognizes block-level elements and comments', () => {
    expect(isBlockHtml('<p align="center">text</p>')).toBe(true)
    expect(isBlockHtml('  <TABLE>')).toBe(true)
    expect(isBlockHtml('<h1 align="center">Title</h1>')).toBe(true)
    expect(isBlockHtml('<!-- note -->')).toBe(true)
  })

  it('leaves inline and unknown elements alone', () => {
    expect(isBlockHtml('<kbd>Ctrl</kbd>')).toBe(false)
    expect(isBlockHtml('<span>x</span>')).toBe(false)
    expect(isBlockHtml('text <b>bold</b>')).toBe(false)
    expect(isBlockHtml('<custom-element>x</custom-element>')).toBe(false)
    expect(isBlockHtml('')).toBe(false)
  })
})

describe('transformHtmlBlocks', () => {
  it('promotes top-level block html to html_block', () => {
    const tree = root([node('html', '<div class="note">x</div>')])
    transformHtmlBlocks(tree as never)
    expect((tree.children as Array<Record<string, unknown>>)[0].type).toBe('html_block')
  })

  it('unwraps paragraphs that only contain block html', () => {
    const tree = root([node('paragraph', undefined, [node('html', '<table><tr></tr></table>')])])
    transformHtmlBlocks(tree as never)
    const children = tree.children as Array<Record<string, unknown>>
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      type: 'html_block',
      value: '<table><tr></tr></table>',
    })
  })

  it('keeps inline html inside paragraphs', () => {
    const tree = root([node('paragraph', undefined, [node('html', '<kbd>Ctrl</kbd>')])])
    transformHtmlBlocks(tree as never)
    const paragraph = (tree.children as Array<Record<string, unknown>>)[0]
    expect(paragraph.type).toBe('paragraph')
    expect((paragraph.children as Array<Record<string, unknown>>)[0].type).toBe('html')
  })

  it('handles block html wrapped by blockquotes', () => {
    const tree = root([
      node('blockquote', undefined, [
        node('paragraph', undefined, [node('html', '<p align="right">right</p>')]),
      ]),
    ])
    transformHtmlBlocks(tree as never)
    const blockquote = (tree.children as Array<Record<string, unknown>>)[0]
    const children = blockquote.children as Array<Record<string, unknown>>
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('html_block')
  })
})
