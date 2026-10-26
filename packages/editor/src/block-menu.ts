import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { NodeSelection, TextSelection, type Transaction } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { PENCIL_ICON } from './icons'
import type { EditorLabels } from './types'

type BlockMenuLabels = EditorLabels['blockMenu']
type BlockMenuAction = 'editHtml' | 'duplicate' | 'moveUp' | 'moveDown' | 'delete'

interface ActiveBlock {
  from: number
  index: number
  node: ProseNode
}

interface BlockMenuOptions {
  view: EditorView
  host: HTMLElement
  labels: BlockMenuLabels
  editHtmlLabel: string
}

interface MenuAction {
  id: BlockMenuAction
  label: string
  icon?: string
  disabled?: boolean
  danger?: boolean
}

export function attachBlockMenu({
  view,
  host,
  labels,
  editHtmlLabel,
}: BlockMenuOptions): () => void {
  let menu: HTMLElement | null = null
  let detachMenu: (() => void) | null = null

  const closeMenu = (): void => {
    detachMenu?.()
    detachMenu = null
    menu?.remove()
    menu = null
  }

  const openMenu = (handle: HTMLElement): void => {
    closeMenu()
    if (!view.editable) return
    const active = activeBlock(handle, view)
    if (!active) return

    const canEditHtml = active.node.type.name === 'html_block'
    const actions: MenuAction[] = []
    if (canEditHtml) {
      actions.push({ id: 'editHtml', label: editHtmlLabel, icon: PENCIL_ICON })
    }
    actions.push(
      { id: 'duplicate', label: labels.duplicate },
      { id: 'moveUp', label: labels.moveUp, disabled: active.index === 0 },
      {
        id: 'moveDown',
        label: labels.moveDown,
        disabled: active.index === view.state.doc.childCount - 1,
      },
      { id: 'delete', label: labels.delete, danger: true },
    )

    const element = document.createElement('div')
    element.className = 'nd-block-menu'
    element.setAttribute('role', 'menu')

    for (const [index, action] of actions.entries()) {
      if (canEditHtml && index === 1) {
        const separator = document.createElement('div')
        separator.className = 'nd-block-menu__separator'
        element.append(separator)
      }

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'nd-block-menu__item'
      button.setAttribute('role', 'menuitem')
      button.disabled = action.disabled ?? false
      button.classList.toggle('is-danger', action.danger ?? false)
      if (action.icon) {
        const icon = document.createElement('span')
        icon.className = 'nd-block-menu__icon'
        icon.innerHTML = action.icon
        const label = document.createElement('span')
        label.textContent = action.label
        button.append(icon, label)
      } else {
        button.textContent = action.label
      }
      button.addEventListener('click', () => {
        runAction(action.id, active)
        closeMenu()
      })
      element.append(button)
    }

    document.body.append(element)
    menu = element
    positionMenu(element, handle)

    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && element.contains(event.target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeMenu()
    }
    const onScroll = (): void => closeMenu()
    const onResize = (): void => closeMenu()

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    detachMenu = () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }

  const runAction = (action: BlockMenuAction, active: ActiveBlock): void => {
    if (!view.editable) return
    const current = view.state.doc.nodeAt(active.from)
    if (!current || !current.eq(active.node)) return

    const { from, index, node } = active
    const doc = view.state.doc
    const tr = view.state.tr

    switch (action) {
      case 'editHtml': {
        const dom = view.nodeDOM(from)
        if (!(dom instanceof HTMLElement)) return
        dom.querySelector<HTMLButtonElement>('.nd-html-block__edit')?.click()
        return
      }
      case 'duplicate': {
        const pos = from + node.nodeSize
        tr.insert(pos, node.copy(node.content))
        selectBlock(tr, pos, node)
        break
      }
      case 'delete':
        tr.delete(from, from + node.nodeSize)
        view.dispatch(tr.scrollIntoView())
        view.focus()
        return
      case 'moveUp': {
        if (index === 0) return
        const previous = doc.child(index - 1)
        const pos = from - previous.nodeSize
        tr.delete(from, from + node.nodeSize).insert(pos, node)
        selectBlock(tr, pos, node)
        break
      }
      case 'moveDown': {
        if (index >= doc.childCount - 1) return
        const next = doc.child(index + 1)
        const pos = from + next.nodeSize
        tr.delete(from, from + node.nodeSize).insert(pos, node)
        selectBlock(tr, pos, node)
        break
      }
    }

    view.dispatch(tr.scrollIntoView())
    view.focus()
  }

  const onClick = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const handle = target.closest<HTMLElement>('.milkdown-block-handle')
    if (!handle) return
    const item = target.closest('.operation-item')
    if (!item || item !== handle.lastElementChild) return
    openMenu(handle)
  }

  host.addEventListener('click', onClick)

  return () => {
    host.removeEventListener('click', onClick)
    closeMenu()
  }
}

function activeBlock(handle: HTMLElement, view: EditorView): ActiveBlock | null {
  const element = blockElementAt(handle, view)
  if (!element) return null

  let pos: number
  try {
    pos = view.posAtDOM(element, 0)
  } catch {
    return null
  }

  const doc = view.state.doc
  const index = doc.resolve(pos).index(0)
  if (index < 0 || index >= doc.childCount) return null
  let from = 0
  for (let i = 0; i < index; i += 1) from += doc.child(i).nodeSize
  return { from, index, node: doc.child(index) }
}

function blockElementAt(handle: HTMLElement, view: EditorView): HTMLElement | null {
  const rect = view.dom.getBoundingClientRect()
  const anchor = handle.getBoundingClientRect()
  let element = view.root.elementFromPoint(
    rect.left + rect.width / 2,
    anchor.top + anchor.height / 2,
  )
  while (element && element !== view.dom && element.parentElement !== view.dom) {
    element = element.parentElement
  }
  return element instanceof HTMLElement && element !== view.dom ? element : null
}

function selectBlock(tr: Transaction, pos: number, node: ProseNode): void {
  if (node.isTextblock) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
  } else {
    tr.setSelection(NodeSelection.create(tr.doc, pos))
  }
}

function positionMenu(menu: HTMLElement, handle: HTMLElement): void {
  const anchor = handle.getBoundingClientRect()
  const rect = menu.getBoundingClientRect()
  const margin = 8
  let left = anchor.right + 8
  let top = anchor.top

  if (left + rect.width > window.innerWidth - margin) {
    left = Math.max(margin, anchor.left - rect.width - 8)
  }
  if (top + rect.height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - rect.height - margin)
  }

  menu.style.left = `${Math.round(left)}px`
  menu.style.top = `${Math.round(top)}px`
}
