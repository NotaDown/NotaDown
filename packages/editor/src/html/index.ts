import { htmlSchema } from '@milkdown/kit/preset/commonmark'
import type { MarkdownNode } from '@milkdown/kit/transformer'
import { $nodeSchema, $remark, $view } from '@milkdown/kit/utils'
import {
  HtmlNodeView,
  type HtmlImageErrorHandler,
  type HtmlImageUrlResolver,
  type HtmlLinkHandler,
} from './node-view'
import { isBlockHtml } from './sanitize'

const remarkHtmlBlocks = $remark(
  'remarkHtmlBlocks',
  () => () => (tree) => {
    transformHtmlBlocks(tree as unknown as MarkdownNode)
  },
)

export function transformHtmlBlocks(node: MarkdownNode): void {
  const children = node.children
  if (!children) return
  const canHoldBlocks = node.type === 'root' || node.type === 'blockquote'

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (!child) continue

    if (canHoldBlocks && child.type === 'paragraph' && child.children?.length === 1) {
      const only = child.children[0]
      if (only?.type === 'html' && isBlockHtml(htmlValue(only))) {
        only.type = 'html_block'
        children[index] = only
        continue
      }
    }

    if (canHoldBlocks && child.type === 'html' && isBlockHtml(htmlValue(child))) {
      child.type = 'html_block'
      continue
    }

    transformHtmlBlocks(child)
  }
}

function htmlValue(node: MarkdownNode): string {
  return typeof node.value === 'string' ? node.value : ''
}

export function createHtmlPlugins(
  onOpenLink: HtmlLinkHandler,
  onImageError?: HtmlImageErrorHandler,
  resolveImageUrl?: HtmlImageUrlResolver,
) {
  const blockSchema = $nodeSchema('html_block', () => ({
    group: 'block',
    atom: true,
    code: true,
    defining: true,
    isolating: true,
    selectable: true,
    draggable: false,
    attrs: {
      value: { default: '' },
    },
    parseDOM: [
      {
        tag: 'div[data-type="html-block"]',
        getAttrs: (dom) => ({
          value: (dom as HTMLElement).dataset.value ?? '',
        }),
      },
    ],
    toDOM: (node) => {
      const dom = document.createElement('div')
      dom.dataset.type = 'html-block'
      dom.dataset.value = String(node.attrs.value ?? '')
      return dom
    },
    parseMarkdown: {
      match: (node) => node.type === 'html_block',
      runner: (state, node, type) => {
        state.addNode(type, { value: htmlValue(node) })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'html_block',
      runner: (state, node) => {
        state.addNode('html', undefined, String(node.attrs.value ?? ''))
      },
    },
  }))

  const blockView = $view(
    blockSchema.node,
    () => (node) =>
      new HtmlNodeView(node, true, onOpenLink, onImageError, resolveImageUrl),
  )

  const inlineView = $view(
    htmlSchema.node,
    () => (node) =>
      new HtmlNodeView(node, false, onOpenLink, onImageError, resolveImageUrl),
  )

  return {
    plugins: [...remarkHtmlBlocks, ...blockSchema, blockView, inlineView],
  }
}
