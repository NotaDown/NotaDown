import { Crepe, CrepeFeature, type CrepeConfig } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'
import {
  linkTooltipAPI,
  type LinkTooltipAPI,
} from '@milkdown/kit/component/link-tooltip'
import {
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  createCodeBlockCommand,
  listItemSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBlockTypeCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { replaceAll } from '@milkdown/kit/utils'
import { keymap } from '@milkdown/kit/prose/keymap'
import { $prose } from '@milkdown/kit/utils'
import {
  joinFrontmatter,
  splitFrontmatter,
  type OutlineItem,
} from '@notadown/shared'
import { attachBlockMenu } from './block-menu'
import { createCodeMirrorTheme } from './codemirror-theme'
import { createHtmlPlugins } from './html'
import { createMermaidPlugins } from './mermaid'
import {
  centerCaret,
  createFocusModePlugin,
  createLinkClickPlugin,
  createTypewriterPlugin,
} from './prosemirror-plugins'
import type {
  EditorCommand,
  EditorLabels,
  FindResult,
  MarkdownEditor,
  MarkdownEditorOptions,
} from './types'

const MERMAID_MENU_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4.5a3 3 0 0 1 3 3V14"/></svg>'

export async function createMarkdownEditor(
  options: MarkdownEditorOptions,
): Promise<MarkdownEditor> {
  const labels = options.labels
  const parts = splitFrontmatter(options.markdown)
  let frontmatter = parts.frontmatter
  let lastMarkdown = options.markdown
  let suppressUpdates = false
  let outlineJson = ''
  let focusMode = options.focusMode ?? false
  let typewriterMode = options.typewriterMode ?? false
  let destroyed = false
  const objectUrls: string[] = []

  const mermaid = createMermaidPlugins(labels.mermaid)
  const openLink = (href: string) => {
    if (options.onOpenLink) options.onOpenLink(href)
    else window.open(href, '_blank', 'noopener,noreferrer')
  }
  const html = createHtmlPlugins(openLink, options.onImageError)

  const focusPlugin = createFocusModePlugin(() => focusMode)
  const typewriterPlugin = createTypewriterPlugin(() => typewriterMode)
  const linkClickPlugin = createLinkClickPlugin(openLink)

  const commandKeymap = $prose((ctx) =>
    keymap({
      'Mod-Shift-x': () => executeCommand(ctx, 'strikethrough', labels, mermaid),
      'Mod-Shift-8': () => executeCommand(ctx, 'bulletList', labels, mermaid),
      'Mod-Shift-7': () => executeCommand(ctx, 'orderedList', labels, mermaid),
      'Mod-Shift-9': () => executeCommand(ctx, 'taskList', labels, mermaid),
      'Mod-Shift-q': () => executeCommand(ctx, 'blockquote', labels, mermaid),
      'Mod-Alt-m': () => executeCommand(ctx, 'math', labels, mermaid),
      'Mod-Alt-d': () => executeCommand(ctx, 'mermaid', labels, mermaid),
      'Mod-k': () => openLinkEditor(ctx, labels),
    }),
  )

  async function uploadFile(file: File): Promise<string> {
    if (options.uploadImage) {
      const image = await options.uploadImage(file)
      return image.src
    }
    const url = URL.createObjectURL(file)
    objectUrls.push(url)
    return url
  }

  const featureConfigs: NonNullable<CrepeConfig['featureConfigs']> = {
    [CrepeFeature.Placeholder]: {
      text: labels.placeholder,
      mode: 'doc',
    },
    [CrepeFeature.ImageBlock]: {
      onUpload: uploadFile,
      inlineOnUpload: uploadFile,
      blockOnUpload: uploadFile,
      inlineUploadButton: labels.image.upload,
      blockUploadButton: labels.image.uploadFile,
      inlineUploadPlaceholderText: labels.image.pasteLink,
      blockUploadPlaceholderText: labels.image.pasteLink,
      blockCaptionPlaceholderText: labels.image.caption,
      proxyDomURL: async (url) => {
        if (!options.resolveImageUrl) return url
        return options.resolveImageUrl(url)
      },
      onImageLoadError: (event) => {
        const target = event.target
        if (target instanceof HTMLImageElement) {
          target.classList.add('nd-image-error')
          options.onImageError?.(target.getAttribute('src') ?? '')
        }
      },
    },
    [CrepeFeature.BlockEdit]: {
      buildMenu: (builder) => {
        builder.getGroup('advanced').addItem('mermaid', {
          label: labels.slash.mermaid,
          icon: MERMAID_MENU_ICON,
          onRun: (ctx) => {
            mermaid.insert(ctx)
          },
        })
      },
      textGroup: {
        label: labels.slash.basic,
        text: { label: labels.slash.text },
        h1: { label: labels.slash.heading1 },
        h2: { label: labels.slash.heading2 },
        h3: { label: labels.slash.heading3 },
        h4: { label: labels.slash.heading4 },
        h5: { label: labels.slash.heading5 },
        h6: { label: labels.slash.heading6 },
        quote: { label: labels.slash.quote },
        divider: { label: labels.slash.divider },
      },
      listGroup: {
        label: labels.slash.lists,
        bulletList: { label: labels.slash.bulletList },
        orderedList: { label: labels.slash.orderedList },
        taskList: { label: labels.slash.taskList },
      },
      advancedGroup: {
        label: labels.slash.advanced,
        image: { label: labels.slash.image },
        codeBlock: { label: labels.slash.codeBlock },
        table: { label: labels.slash.table },
        math: { label: labels.slash.math },
      },
    },
    [CrepeFeature.CodeMirror]: {
      theme: createCodeMirrorTheme(),
      searchPlaceholder: labels.codeBlock.searchLanguage,
      noResultText: labels.codeBlock.noResult,
      copyText: labels.codeBlock.copy,
      previewLoading: labels.codeBlock.loading,
      previewToggleText: (previewOnly) =>
        previewOnly ? labels.codeBlock.edit : labels.codeBlock.hide,
      previewOnlyByDefault: false,
    },
    [CrepeFeature.Toolbar]: {
      boldLabel: labels.toolbar.bold,
      italicLabel: labels.toolbar.italic,
      strikethroughLabel: labels.toolbar.strikethrough,
      codeLabel: labels.toolbar.inlineCode,
      linkLabel: labels.toolbar.link,
      latexLabel: labels.toolbar.math,
    },
    [CrepeFeature.LinkTooltip]: {
      inputPlaceholder: labels.link.placeholder,
      editButton: labels.link.edit,
      removeButton: labels.link.remove,
      confirmButton: labels.link.confirm,
      onCopyLink: (link) => {
        void navigator.clipboard.writeText(link)
      },
    },
    [CrepeFeature.Latex]: {
      katexOptions: { throwOnError: false, strict: false },
    },
  }

  const host = document.createElement('div')
  host.className = 'nd-editor'
  options.root.append(host)

  const crepe = new Crepe({
    root: host,
    defaultValue: parts.body,
    features: {
      [CrepeFeature.TopBar]: false,
      [CrepeFeature.AI]: false,
    },
    featureConfigs,
  })

  crepe.editor.use([
    ...mermaid.plugins,
    ...html.plugins,
    focusPlugin,
    typewriterPlugin,
    linkClickPlugin,
    commandKeymap,
  ])

  await crepe.create()

  if (options.readOnly) crepe.setReadonly(true)

  const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx))
  view.dom.spellcheck = options.spellcheck ?? true
  const detachBlockMenu = attachBlockMenu({ view, host, labels: labels.blockMenu })

  let serializeTimer: number | null = null
  const serializeDelay = options.largeDocument ? 700 : 180

  function flushUpdates(): void {
    if (serializeTimer !== null) {
      window.clearTimeout(serializeTimer)
      serializeTimer = null
    }
    if (suppressUpdates || destroyed) return
    const full = joinFrontmatter(frontmatter, crepe.getMarkdown())
    if (full === lastMarkdown) return
    lastMarkdown = full
    options.onChange?.(full)
    updateOutline()
  }

  function scheduleUpdates(): void {
    if (suppressUpdates || serializeTimer !== null) return
    serializeTimer = window.setTimeout(() => {
      serializeTimer = null
      flushUpdates()
    }, serializeDelay)
  }

  crepe.on((listener) => {
    listener.updated(() => scheduleUpdates())
  })

  function updateOutline(): void {
    const items = collectOutline(view)
    const json = JSON.stringify(items)
    if (json === outlineJson) return
    outlineJson = json
    options.onOutlineChange?.(items)
  }

  updateOutline()

  const focusListener = () => options.onFocus?.()
  const blurListener = (event: FocusEvent) => {
    const next = event.relatedTarget
    if (next instanceof Node && host.contains(next)) return
    options.onBlur?.()
  }
  view.dom.addEventListener('focus', focusListener)
  view.dom.addEventListener('blur', blurListener)

  return {
    getMarkdown: () => joinFrontmatter(frontmatter, crepe.getMarkdown()),
    flush: flushUpdates,
    setMarkdown(markdown: string, setOptions?: { silent?: boolean }) {
      if (serializeTimer !== null) {
        window.clearTimeout(serializeTimer)
        serializeTimer = null
      }
      const next = splitFrontmatter(markdown)
      frontmatter = next.frontmatter
      const silent = setOptions?.silent ?? true
      suppressUpdates = silent
      try {
        crepe.editor.action(replaceAll(next.body))
      } finally {
        suppressUpdates = false
      }
      lastMarkdown = markdown
      updateOutline()
    },
    getOutline: () => collectOutline(view),
    focus: () => view.focus(),
    destroy() {
      if (destroyed) return
      if (serializeTimer !== null) {
        window.clearTimeout(serializeTimer)
        serializeTimer = null
      }
      destroyed = true
      view.dom.removeEventListener('focus', focusListener)
      view.dom.removeEventListener('blur', blurListener)
      detachBlockMenu()
      for (const url of objectUrls) URL.revokeObjectURL(url)
      void crepe.destroy()
      host.remove()
    },
    setReadOnly(value) {
      crepe.setReadonly(value)
    },
    setFocusMode(value) {
      focusMode = value
      view.dispatch(view.state.tr)
    },
    setTypewriterMode(value) {
      typewriterMode = value
      if (value) window.requestAnimationFrame(() => centerCaret(view))
    },
    runCommand(command) {
      return crepe.editor.action((ctx) => executeCommand(ctx, command, labels, mermaid))
    },
    find(query, forward = true) {
      return findInEditor(view, query, forward)
    },
    clearFind() {
      view.focus()
    },
    goToPosition(pos) {
      const position = Math.max(0, Math.min(pos + 1, view.state.doc.content.size))
      view.dispatch(
        view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))).scrollIntoView(),
      )
      view.focus()
    },
    refreshLayout() {
      if (typewriterMode) centerCaret(view)
    },
  }
}

function executeCommand(
  ctx: Ctx,
  command: EditorCommand,
  labels: EditorLabels,
  mermaid: ReturnType<typeof createMermaidPlugins>,
): boolean {
  const commands = ctx.get(commandsCtx)
  switch (command) {
    case 'bold':
      return commands.call(toggleStrongCommand.key)
    case 'italic':
      return commands.call(toggleEmphasisCommand.key)
    case 'strikethrough':
      return commands.call(toggleStrikethroughCommand.key)
    case 'inlineCode':
      return commands.call(toggleInlineCodeCommand.key)
    case 'link':
      return openLinkEditor(ctx, labels)
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
      return commands.call(wrapInHeadingCommand.key, Number(command.slice(-1)))
    case 'paragraph':
      return commands.call(wrapInHeadingCommand.key, 0)
    case 'bulletList':
      return commands.call(wrapInBulletListCommand.key)
    case 'orderedList':
      return commands.call(wrapInOrderedListCommand.key)
    case 'taskList':
      return commands.call(wrapInBlockTypeCommand.key, {
        nodeType: listItemSchema.type(ctx),
        attrs: { checked: false },
      })
    case 'blockquote':
      return commands.call(wrapInBlockquoteCommand.key)
    case 'codeBlock':
      return commands.call(createCodeBlockCommand.key)
    case 'math':
      commands.call(clearTextInCurrentBlockCommand.key)
      return commands.call(addBlockTypeCommand.key, {
        nodeType: codeBlockSchema.type(ctx),
        attrs: { language: 'LaTeX' },
      })
    case 'mermaid':
      return mermaid.insert(ctx)
    case 'undo':
      return commands.call(undoCommand.key)
    case 'redo':
      return commands.call(redoCommand.key)
  }
}

function openLinkEditor(ctx: Ctx, labels: EditorLabels): boolean {
  const view = ctx.get(editorViewCtx)
  let api: LinkTooltipAPI
  try {
    api = ctx.get(linkTooltipAPI.key)
  } catch {
    return false
  }
  if (!api) return false
  const { from, to, empty } = view.state.selection
  if (empty) {
    const text = labels.link.text
    const transaction = view.state.tr.insertText(text, from, to)
    transaction.setSelection(TextSelection.create(transaction.doc, from, from + text.length))
    view.dispatch(transaction)
    view.focus()
    api.addLink(from, from + text.length)
    return true
  }
  view.focus()
  api.addLink(from, to)
  return true
}

function findInEditor(view: EditorView, query: string, forward: boolean): FindResult | null {
  const needle = query.trim()
  if (!needle) return null
  const matches = collectTextMatches(view.state.doc, needle)
  if (!matches.length) return null

  const selection = view.state.selection
  let index = -1
  if (forward) {
    index = matches.findIndex((match) => match.from >= selection.to)
    if (index < 0) index = 0
  } else {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      if (matches[i].to <= selection.from) {
        index = i
        break
      }
    }
    if (index < 0) index = matches.length - 1
  }

  const match = matches[index]
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
      .scrollIntoView(),
  )
  view.focus()
  return { index: index + 1, total: matches.length, from: match.from, to: match.to }
}

function collectTextMatches(
  doc: EditorView['state']['doc'],
  needle: string,
): Array<{ from: number; to: number }> {
  const lower = needle.toLowerCase()
  const matches: Array<{ from: number; to: number }> = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let index = text.indexOf(lower)
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + needle.length })
      index = text.indexOf(lower, index + needle.length)
    }
  })
  return matches
}

function collectOutline(view: EditorView): OutlineItem[] {
  const outline: OutlineItem[] = []
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const level = Number(node.attrs.level)
    const text = node.textContent.trim()
    if (!level || !text) return
    outline.push({ level, text, pos })
  })
  return outline
}
