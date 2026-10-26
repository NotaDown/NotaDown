import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import type { EditorLabels } from '../types'
import { isBlockHtml, renderSanitizedHtml } from './sanitize'

export type HtmlLinkHandler = (href: string) => void
export type HtmlImageErrorHandler = (src: string) => void
export type HtmlImageUrlResolver = (src: string) => string | Promise<string>
type GetPos = () => number | undefined
type HtmlEditorLabels = EditorLabels['html']

export class HtmlNodeView implements NodeView {
  readonly dom: HTMLElement
  node: ProseNode

  private readonly block: boolean
  private readonly view: EditorView | null
  private readonly getPos: GetPos | null
  private readonly onOpenLink: HtmlLinkHandler
  private readonly onImageError?: HtmlImageErrorHandler
  private readonly resolveImageUrl?: HtmlImageUrlResolver
  private readonly content: HTMLElement
  private readonly editButton: HTMLButtonElement | null = null
  private readonly editor: HTMLElement | null = null
  private readonly source: HTMLTextAreaElement | null = null
  private renderToken = 0
  private editing = false

  constructor(
    node: ProseNode,
    block: boolean,
    view: EditorView | null,
    getPos: GetPos | null,
    labels: HtmlEditorLabels | null,
    onOpenLink: HtmlLinkHandler,
    onImageError?: HtmlImageErrorHandler,
    resolveImageUrl?: HtmlImageUrlResolver,
  ) {
    this.node = node
    this.block = block
    this.view = view
    this.getPos = getPos
    this.onOpenLink = onOpenLink
    this.onImageError = onImageError
    this.resolveImageUrl = resolveImageUrl

    const dom = document.createElement(block ? 'div' : 'span')
    dom.className = block ? 'nd-html-block' : 'nd-html-inline'
    dom.contentEditable = 'false'
    dom.addEventListener('click', this.handleClick)
    dom.addEventListener('error', this.handleError, true)
    this.dom = dom

    if (!block) {
      this.content = dom
      this.render()
      return
    }

    const content = document.createElement('div')
    content.className = 'nd-html-block__content'

    const editButton = createEditButton(labels?.edit ?? '', this.openEditor)

    const editor = document.createElement('div')
    editor.className = 'nd-html-block__editor'
    editor.hidden = true

    const source = document.createElement('textarea')
    source.className = 'nd-html-block__source'
    source.spellcheck = false
    source.placeholder = labels?.sourcePlaceholder ?? ''
    source.addEventListener('keydown', this.onEditorKeyDown)

    const actions = document.createElement('div')
    actions.className = 'nd-html-block__actions'
    const cancelButton = createButton(labels?.cancel ?? '', this.closeEditor)
    const applyButton = createButton(labels?.apply ?? '', this.applySource)
    applyButton.classList.add('is-primary')
    actions.append(cancelButton, applyButton)

    editor.append(source, actions)
    dom.append(content, editButton, editor)

    this.content = content
    this.editButton = editButton
    this.editor = editor
    this.source = source
    this.render()
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false
    const changed = node.attrs.value !== this.node.attrs.value
    this.node = node
    if (changed) {
      if (!this.editing && this.source) {
        this.source.value = String(node.attrs.value ?? '')
      }
      this.render()
    }
    return true
  }

  selectNode(): void {
    this.dom.classList.add('is-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected')
  }

  stopEvent(event: Event): boolean {
    const target = event.target
    if (!(target instanceof Element)) return false
    if (target.closest('button, textarea')) return true
    return (
      event.type === 'click' &&
      Boolean(target.closest('a[href], summary'))
    )
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.renderToken += 1
    this.dom.removeEventListener('click', this.handleClick)
    this.dom.removeEventListener('error', this.handleError, true)
    this.source?.removeEventListener('keydown', this.onEditorKeyDown)
  }

  private render(): void {
    const raw = String(this.node.attrs.value ?? '')
    const hasContent = renderSanitizedHtml(this.content, raw)
    this.dom.classList.toggle('is-empty', !hasContent)
    if (this.block) {
      this.dom.hidden = !hasContent && !this.editing
    } else {
      this.dom.classList.toggle('is-block', isBlockHtml(raw))
    }
    this.resolveImages()
  }

  private resolveImages(): void {
    const resolver = this.resolveImageUrl
    if (!resolver) return
    const token = ++this.renderToken
    for (const image of this.content.querySelectorAll<HTMLImageElement>('img[src]')) {
      const src = image.getAttribute('src')
      if (!src) continue
      let resolved: string | Promise<string>
      try {
        resolved = resolver(src)
      } catch {
        continue
      }
      if (typeof resolved === 'string') {
        if (resolved !== src) image.setAttribute('src', resolved)
        continue
      }
      void resolved
        .then((url) => {
          if (!url || token !== this.renderToken) return
          image.setAttribute('src', url)
        })
        .catch(() => undefined)
    }
  }

  private readonly openEditor = (): void => {
    if (!this.view || !this.getPos || !this.editButton || !this.editor || !this.source) return
    if (this.editing) return
    this.editing = true
    this.source.value = String(this.node.attrs.value ?? '')
    this.content.hidden = true
    this.editButton.hidden = true
    this.editor.hidden = false
    this.dom.classList.add('is-editing')
    this.source.focus()
    this.source.setSelectionRange(this.source.value.length, this.source.value.length)
  }

  private readonly closeEditor = (): void => {
    if (!this.editing) return
    this.editing = false
    this.dom.classList.remove('is-editing')
    if (this.editButton) this.editButton.hidden = false
    if (this.editor) this.editor.hidden = true
    this.content.hidden = false
  }

  private readonly applySource = (): void => {
    if (!this.view || !this.getPos || !this.source) return
    const pos = this.getPos()
    if (typeof pos !== 'number') return
    const value = this.source.value
    const changed = value !== this.node.attrs.value
    this.closeEditor()
    if (!changed) return
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { value }))
    this.view.focus()
  }

  private readonly onEditorKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.closeEditor()
      this.view?.focus()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      this.applySource()
    }
    event.stopPropagation()
  }

  private readonly handleClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const anchor = target.closest('a[href]')
    if (!anchor) return
    event.preventDefault()
    event.stopPropagation()
    const href = anchor.getAttribute('href')
    if (href) this.onOpenLink(href)
  }

  private readonly handleError = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    target.classList.add('nd-image-error')
    this.onImageError?.(target.getAttribute('src') ?? '')
  }
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nd-html-block__button'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

const EDIT_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'

function createEditButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nd-html-block__edit'
  button.title = label
  button.setAttribute('aria-label', label)
  button.innerHTML = EDIT_ICON
  button.addEventListener('click', onClick)
  return button
}
