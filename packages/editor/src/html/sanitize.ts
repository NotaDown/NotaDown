import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'picture',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var',
  'wbr',
]

const ALLOWED_ATTR = [
  'align',
  'alt',
  'cite',
  'colspan',
  'datetime',
  'dir',
  'headers',
  'height',
  'href',
  'lang',
  'media',
  'open',
  'reversed',
  'rowspan',
  'scope',
  'sizes',
  'span',
  'src',
  'srcset',
  'start',
  'title',
  'type',
  'valign',
  'width',
]

const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify'])

const BLOCK_HTML = new RegExp(
  String.raw`^<\s*(?:!--|\/?\s*(?:address|article|aside|blockquote|center|details|dialog|div|dl|dd|dt|fieldset|figcaption|figure|footer|h[1-6]|header|hgroup|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)\b)`,
  'i',
)

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
}

export function isBlockHtml(value: string): boolean {
  return BLOCK_HTML.test(value.trim())
}

export function renderSanitizedHtml(target: HTMLElement, raw: string): boolean {
  target.innerHTML = DOMPurify.sanitize(raw, PURIFY_CONFIG)

  for (const anchor of target.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }

  for (const image of target.querySelectorAll<HTMLImageElement>('img')) {
    image.loading = 'lazy'
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
  }

  for (const element of target.querySelectorAll<HTMLElement>('[align]')) {
    const align = element.getAttribute('align')?.toLowerCase() ?? ''
    element.removeAttribute('align')
    if (!ALIGNMENTS.has(align)) continue
    if (element instanceof HTMLImageElement) {
      if (align === 'center') {
        element.style.display = 'block'
        element.style.marginInline = 'auto'
      } else {
        element.style.float = align
      }
    } else {
      element.style.textAlign = align
    }
  }

  return target.childNodes.length > 0
}
