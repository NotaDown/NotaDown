import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { isBlockHtml, renderSanitizedHtml } from './sanitize'

export type HtmlLinkHandler = (href: string) => void
export type HtmlImageErrorHandler = (src: string) => void
export type HtmlImageUrlResolver = (src: string) => string | Promise<string>

export class HtmlNodeView implements NodeView {
  readonly dom: HTMLElement
  node: ProseNode

  private readonly block: boolean
  private readonly onOpenLink: HtmlLinkHandler
  private readonly onImageError?: HtmlImageErrorHandler
  private readonly resolveImageUrl?: HtmlImageUrlResolver
  private renderToken = 0

  constructor(
    node: ProseNode,
    block: boolean,
    onOpenLink: HtmlLinkHandler,
    onImageError?: HtmlImageErrorHandler,
    resolveImageUrl?: HtmlImageUrlResolver,
  ) {
    this.node = node
    this.block = block
    this.onOpenLink = onOpenLink
    this.onImageError = onImageError
    this.resolveImageUrl = resolveImageUrl

    const dom = document.createElement(block ? 'div' : 'span')
    dom.className = block ? 'nd-html-block' : 'nd-html-inline'
    dom.contentEditable = 'false'
    dom.addEventListener('click', this.handleClick)
    dom.addEventListener('error', this.handleError, true)
    this.dom = dom

    this.render()
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false
    const changed = node.attrs.value !== this.node.attrs.value
    this.node = node
    if (changed) this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    return (
      event.type === 'click' &&
      event.target instanceof Element &&
      Boolean(event.target.closest('a[href], summary'))
    )
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.renderToken += 1
    this.dom.removeEventListener('click', this.handleClick)
    this.dom.removeEventListener('error', this.handleError, true)
  }

  private render(): void {
    const raw = String(this.node.attrs.value ?? '')
    const hasContent = renderSanitizedHtml(this.dom, raw)
    this.dom.classList.toggle('is-empty', !hasContent)
    if (this.block) {
      this.dom.hidden = !hasContent
    } else {
      this.dom.classList.toggle('is-block', isBlockHtml(raw))
    }
    this.resolveImages()
  }

  private resolveImages(): void {
    const resolver = this.resolveImageUrl
    if (!resolver) return
    const token = ++this.renderToken
    for (const image of this.dom.querySelectorAll<HTMLImageElement>('img[src]')) {
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
