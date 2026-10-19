import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { NodeSelection } from '@milkdown/kit/prose/state'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import type { EditorLabels } from '../types'
import { renderMermaid } from './render'

type GetPos = () => number | undefined

export class MermaidNodeView implements NodeView {
  readonly dom: HTMLElement
  node: ProseNode

  private readonly view: EditorView
  private readonly getPos: GetPos
  private readonly labels: EditorLabels['mermaid']
  private readonly preview: HTMLElement
  private readonly editor: HTMLElement
  private readonly source: HTMLTextAreaElement
  private readonly error: HTMLElement
  private readonly editButton: HTMLButtonElement
  private readonly copyButton: HTMLButtonElement
  private readonly themeObserver: MutationObserver | null
  private renderToken = 0
  private renderTimer: number | null = null
  private editing = false

  constructor(
    node: ProseNode,
    view: EditorView,
    getPos: GetPos,
    labels: EditorLabels['mermaid'],
  ) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.labels = labels

    const dom = document.createElement('div')
    dom.className = 'nd-mermaid'
    dom.contentEditable = 'false'

    const header = document.createElement('div')
    header.className = 'nd-mermaid__header'

    const title = document.createElement('span')
    title.className = 'nd-mermaid__title'
    title.textContent = labels.title

    const actions = document.createElement('div')
    actions.className = 'nd-mermaid__actions'

    this.copyButton = createButton(labels.copy, 'copy')
    this.editButton = createButton(labels.edit, 'edit')
    actions.append(this.copyButton, this.editButton)

    header.append(title, actions)

    const body = document.createElement('div')
    body.className = 'nd-mermaid__body'

    this.preview = document.createElement('div')
    this.preview.className = 'nd-mermaid__preview'

    this.error = document.createElement('div')
    this.error.className = 'nd-mermaid__error'
    this.error.hidden = true

    const editor = document.createElement('div')
    editor.className = 'nd-mermaid__editor'
    editor.hidden = true

    this.source = document.createElement('textarea')
    this.source.className = 'nd-mermaid__source'
    this.source.placeholder = labels.sourcePlaceholder
    this.source.spellcheck = false

    const editorActions = document.createElement('div')
    editorActions.className = 'nd-mermaid__editor-actions'
    const cancelButton = createButton(labels.cancel, 'cancel')
    const doneButton = createButton(labels.done, 'done')
    doneButton.classList.add('is-primary')
    editorActions.append(cancelButton, doneButton)

    editor.append(this.source, editorActions)
    this.editor = editor
    body.append(this.preview, this.error, editor)

    dom.append(header, body)
    this.dom = dom

    this.preview.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      const pos = this.getPos()
      if (typeof pos !== 'number') return
      event.preventDefault()
      this.view.dispatch(
        this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)),
      )
      this.view.focus()
    })

    this.editButton.addEventListener('click', () => this.openEditor())
    this.copyButton.addEventListener('click', () => void this.copySource())
    cancelButton.addEventListener('click', () => this.closeEditor())
    doneButton.addEventListener('click', () => this.applySource())
    this.source.addEventListener('keydown', (event) => this.onKeyDown(event))

    this.themeObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => this.scheduleRender())
    this.themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'data-theme'],
    })

    void this.render()
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false
    const changed = node.attrs.value !== this.node.attrs.value
    this.node = node
    if (changed) {
      if (!this.editing) this.source.value = node.attrs.value as string
      void this.render()
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
    return target instanceof Element && Boolean(target.closest('button, textarea'))
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.renderToken += 1
    this.themeObserver?.disconnect()
    if (this.renderTimer) window.clearTimeout(this.renderTimer)
    this.dom.remove()
  }

  private openEditor(): void {
    this.editing = true
    this.source.value = this.node.attrs.value as string
    this.editor.hidden = false
    this.editButton.disabled = true
    this.source.focus()
    this.source.setSelectionRange(this.source.value.length, this.source.value.length)
  }

  private closeEditor(): void {
    this.editing = false
    this.editor.hidden = true
    this.editButton.disabled = false
  }

  private applySource(): void {
    const pos = this.getPos()
    if (typeof pos !== 'number') return
    const value = this.source.value
    this.closeEditor()
    if (value === this.node.attrs.value) return
    this.view.dispatch(this.view.state.tr.setNodeMarkup(pos, undefined, { value }))
    this.view.focus()
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.closeEditor()
      this.view.focus()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      this.applySource()
    }
    event.stopPropagation()
  }

  private async copySource(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.node.attrs.value as string)
      this.copyButton.textContent = this.labels.copied
      window.setTimeout(() => {
        this.copyButton.textContent = this.labels.copy
      }, 1400)
    } catch {
      // Clipboard permission can be denied; leave the button unchanged.
    }
  }

  private scheduleRender(): void {
    if (this.renderTimer) window.clearTimeout(this.renderTimer)
    this.renderTimer = window.setTimeout(() => void this.render(), 80)
  }

  private async render(): Promise<void> {
    const token = ++this.renderToken
    const code = String(this.node.attrs.value ?? '')
    this.error.hidden = true

    if (!code.trim()) {
      this.preview.replaceChildren()
      const empty = document.createElement('div')
      empty.className = 'nd-mermaid__empty'
      empty.textContent = this.labels.empty
      this.preview.append(empty)
      return
    }

    this.preview.classList.add('is-loading')
    try {
      const result = await renderMermaid(code)
      if (token !== this.renderToken) return
      this.preview.innerHTML = result.svg
      result.bind?.(this.preview)
    } catch {
      if (token !== this.renderToken) return
      this.preview.replaceChildren()
      this.error.hidden = false
      this.error.textContent = this.labels.renderFailed
    } finally {
      if (token === this.renderToken) this.preview.classList.remove('is-loading')
    }
  }
}

function createButton(label: string, action: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nd-mermaid__button'
  button.dataset.action = action
  button.textContent = label
  return button
}
