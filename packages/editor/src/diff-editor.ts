import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { createCodeMirrorTheme } from './codemirror-theme'
import type { DiffEditor, DiffEditorOptions } from './types'

// 合并视图的高度、滚动由 .nd-diff-editor 的普通 CSS 负责：theme 选择器只能命中编辑器内部元素。
const mergeLayout = EditorView.theme({
  '&.cm-merge-a .cm-changedLine, .cm-deletedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--nd-danger) 10%, transparent)',
  },
  '&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine': {
    backgroundColor: 'color-mix(in srgb, var(--nd-success) 10%, transparent)',
  },
  '.cm-changedText, .cm-deletedChunk .cm-deletedText': {
    background: 'none',
  },
  '.cm-deletedChunk': { paddingLeft: '2px' },
  '.cm-deletedLineGutter, &.cm-merge-a .cm-changedLineGutter': {
    background: 'color-mix(in srgb, var(--nd-danger) 55%, transparent)',
  },
  '&.cm-merge-b .cm-changedLineGutter': {
    background: 'color-mix(in srgb, var(--nd-success) 55%, transparent)',
  },
  '.cm-collapsedLines': {
    color: 'var(--nd-text-muted)',
    background: 'var(--nd-surface)',
  },
})

export function createDiffEditor(options: DiffEditorOptions): DiffEditor {
  const base = [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    lineNumbers(),
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    EditorView.darkTheme.of(options.dark ?? false),
    createCodeMirrorTheme(),
    mergeLayout,
  ]
  if (options.labels) {
    base.push(EditorState.phrases.of({ '$ unchanged lines': options.labels.unchangedLines }))
  }

  const view = new MergeView({
    a: { doc: options.original, extensions: base },
    b: { doc: options.modified, extensions: base },
    parent: options.root,
    highlightChanges: true,
    gutter: true,
    collapseUnchanged: { margin: 3, minSize: 6 },
  })

  return {
    destroy() {
      view.destroy()
    },
  }
}
