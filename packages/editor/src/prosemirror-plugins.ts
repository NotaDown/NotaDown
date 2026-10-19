import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

const focusPluginKey = new PluginKey('notadown-focus')
const typewriterPluginKey = new PluginKey('notadown-typewriter')
const linkClickPluginKey = new PluginKey('notadown-link-click')

export function createFocusModePlugin(isEnabled: () => boolean) {
  return $prose(
    () =>
      new Plugin({
        key: focusPluginKey,
        props: {
          decorations(state) {
            if (!isEnabled()) return null
            const { from, to } = state.selection
            const decorations: Decoration[] = []
            state.doc.forEach((node, offset) => {
              const nodeFrom = offset
              const nodeTo = offset + node.nodeSize
              if (from <= nodeTo && to >= nodeFrom) return
              decorations.push(
                Decoration.node(nodeFrom, nodeTo, { class: 'nd-focus-dim' }),
              )
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
  )
}

export function createTypewriterPlugin(isEnabled: () => boolean) {
  return $prose(
    () =>
      new Plugin({
        key: typewriterPluginKey,
        view() {
          let frame = 0
          return {
            update(view, previous) {
              if (!isEnabled()) return
              if (view.state.doc === previous.doc && view.state.selection.eq(previous.selection)) {
                return
              }
              window.cancelAnimationFrame(frame)
              frame = window.requestAnimationFrame(() => centerCaret(view))
            },
            destroy() {
              window.cancelAnimationFrame(frame)
            },
          }
        },
      }),
  )
}

export function centerCaret(view: EditorView): void {
  const scroller = findScrollParent(view.dom)
  if (!scroller) return
  const coords = view.coordsAtPos(view.state.selection.head)
  const rect = scroller.getBoundingClientRect()
  const target = rect.top + rect.height * 0.44
  const delta = coords.top - target
  if (Math.abs(delta) > 6) scroller.scrollBy({ top: delta })
}

export function findScrollParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement
  while (current) {
    const overflow = getComputedStyle(current).overflowY
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
      return current
    }
    current = current.parentElement
  }
  return null
}

export function createLinkClickPlugin(onOpenLink: (href: string) => void) {
  return $prose(
    () =>
      new Plugin({
        key: linkClickPluginKey,
        props: {
          handleClick(view, pos, event) {
            if (!(event.metaKey || event.ctrlKey)) return false
            const mark = view.state.doc
              .resolve(pos)
              .marks()
              .find((candidate) => candidate.type.name === 'link')
            const href = mark?.attrs.href
            if (typeof href !== 'string' || !href) return false
            event.preventDefault()
            onOpenLink(href)
            return true
          },
        },
      }),
  )
}
