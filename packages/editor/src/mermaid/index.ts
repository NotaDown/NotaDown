import { $remark, $nodeSchema, $view } from '@milkdown/kit/utils'
import { commandsCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import { addBlockTypeCommand, clearTextInCurrentBlockCommand } from '@milkdown/kit/preset/commonmark'
import type { MarkdownNode } from '@milkdown/kit/transformer'
import type { EditorLabels } from '../types'
import { MermaidNodeView } from './node-view'

export const DEFAULT_MERMAID = `graph TD
  A[Start] --> B[End]`

const MERMAID_LANGUAGES = new Set(['mermaid', 'mmd'])

const remarkMermaid = $remark(
  'remarkMermaid',
  () => () => (tree) => {
    transform(tree as unknown as MarkdownNode)
  },
)

function transform(node: MarkdownNode): void {
  const code = node as MarkdownNode & { lang?: string }
  if (node.type === 'code' && typeof code.lang === 'string') {
    const language = code.lang.split(/\s+/)[0]?.toLowerCase() ?? ''
    if (MERMAID_LANGUAGES.has(language)) {
      node.type = 'mermaid'
      code.lang = undefined
    }
  }
  node.children?.forEach(transform)
}

export function createMermaidPlugins(labels: EditorLabels['mermaid']) {
  const schema = $nodeSchema('mermaid', () => ({
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
        tag: 'div[data-type="mermaid"]',
        getAttrs: (dom) => ({
          value: (dom as HTMLElement).dataset.value ?? '',
        }),
      },
    ],
    toDOM: (node) => {
      const dom = document.createElement('div')
      dom.dataset.type = 'mermaid'
      dom.dataset.value = String(node.attrs.value ?? '')
      dom.textContent = String(node.attrs.value ?? '')
      return dom
    },
    parseMarkdown: {
      match: (node) => node.type === 'mermaid',
      runner: (state, node, type) => {
        state.addNode(type, { value: typeof node.value === 'string' ? node.value : '' })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'mermaid',
      runner: (state, node) => {
        state.addNode('code', undefined, String(node.attrs.value ?? ''), { lang: 'mermaid' })
      },
    },
  }))

  const view = $view(
    schema.node,
    () => (node, editorView, getPos) =>
      new MermaidNodeView(node, editorView, getPos, labels),
  )

  const insert = (ctx: Ctx): boolean => {
    const commands = ctx.get(commandsCtx)
    commands.call(clearTextInCurrentBlockCommand.key)
    return commands.call(addBlockTypeCommand.key, {
      nodeType: schema.type(ctx),
      attrs: { value: DEFAULT_MERMAID },
    })
  }

  return {
    schema,
    insert,
    plugins: [...remarkMermaid, ...schema, view],
  }
}

export type MermaidPlugins = ReturnType<typeof createMermaidPlugins>
