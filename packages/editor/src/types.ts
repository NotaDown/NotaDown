import type { OutlineItem } from '@notadown/shared'

export interface EditorLabels {
  placeholder: string
  slash: {
    basic: string
    lists: string
    advanced: string
    text: string
    heading1: string
    heading2: string
    heading3: string
    heading4: string
    heading5: string
    heading6: string
    quote: string
    divider: string
    bulletList: string
    orderedList: string
    taskList: string
    image: string
    codeBlock: string
    table: string
    math: string
    mermaid: string
  }
  codeBlock: {
    searchLanguage: string
    noResult: string
    copy: string
    edit: string
    hide: string
    loading: string
  }
  image: {
    uploadFile: string
    upload: string
    pasteLink: string
    caption: string
  }
  mermaid: {
    title: string
    edit: string
    done: string
    cancel: string
    copy: string
    copied: string
    empty: string
    renderFailed: string
    sourcePlaceholder: string
  }
  link: {
    edit: string
    remove: string
    confirm: string
    placeholder: string
    text: string
  }
  toolbar: {
    bold: string
    italic: string
    strikethrough: string
    inlineCode: string
    link: string
    math: string
  }
  find: {
    find: string
    replace: string
    next: string
    previous: string
    all: string
    matchCase: string
    byWord: string
    regexp: string
    replaceAction: string
    replaceAll: string
    close: string
  }
  blockMenu: {
    duplicate: string
    moveUp: string
    moveDown: string
    delete: string
  }
}

export interface EditorImage {
  src: string
  displayUrl?: string
}

export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inlineCode'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'paragraph'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'math'
  | 'mermaid'
  | 'undo'
  | 'redo'

export interface FindResult {
  index: number
  total: number
  from: number
  to: number
}

export interface MarkdownEditorOptions {
  root: HTMLElement
  markdown: string
  labels: EditorLabels
  onChange?: (markdown: string) => void
  onOutlineChange?: (outline: OutlineItem[]) => void
  onOpenLink?: (href: string) => void
  uploadImage?: (file: File) => Promise<EditorImage>
  resolveImageUrl?: (src: string) => string | Promise<string>
  onImageError?: (src: string) => void
  onFocus?: () => void
  onBlur?: () => void
  focusMode?: boolean
  typewriterMode?: boolean
  readOnly?: boolean
  spellcheck?: boolean
  largeDocument?: boolean
}

export interface MarkdownEditor {
  getMarkdown(): string
  flush(): void
  setMarkdown(markdown: string, options?: { silent?: boolean }): void
  getOutline(): OutlineItem[]
  focus(): void
  destroy(): void
  setReadOnly(value: boolean): void
  setFocusMode(value: boolean): void
  setTypewriterMode(value: boolean): void
  runCommand(command: EditorCommand): boolean
  find(query: string, forward?: boolean): FindResult | null
  clearFind(): void
  goToPosition(pos: number): void
  refreshLayout(): void
}

export interface SourceEditorOptions {
  root: HTMLElement
  value: string
  labels: EditorLabels
  onChange?: (value: string) => void
  onSave?: () => void
  onBlur?: () => void
  readOnly?: boolean
  spellcheck?: boolean
  largeDocument?: boolean
}

export interface SourceEditor {
  getValue(): string
  setValue(value: string): void
  focus(): void
  destroy(): void
  setReadOnly(value: boolean): void
  find(query: string, forward?: boolean): FindResult | null
  clearFind(): void
  goToPosition(pos: number): void
}
