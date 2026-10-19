import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

const highlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: 'var(--nd-syn-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--nd-syn-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--nd-syn-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--nd-syn-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--nd-syn-function)' },
  { tag: [tags.variableName, tags.propertyName, tags.attributeName], color: 'var(--nd-syn-variable)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator], color: 'var(--nd-syn-operator)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--nd-syn-type)' },
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: 'var(--nd-text)', fontWeight: '700' },
  { tag: tags.strong, color: 'var(--nd-text)', fontWeight: '700' },
  { tag: tags.emphasis, color: 'var(--nd-text)', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: 'var(--nd-text-muted)', textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--nd-accent)' },
  { tag: tags.monospace, color: 'var(--nd-inline-code)' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--nd-text-muted)' },
  { tag: tags.quote, color: 'var(--nd-text-secondary)', fontStyle: 'italic' },
])

export function createCodeMirrorTheme(): Extension {
  return [
    EditorView.theme({
      '&': {
        color: 'var(--nd-text)',
        backgroundColor: 'transparent',
        height: '100%',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: 'var(--nd-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)',
        fontSize: 'var(--nd-code-font-size, 13.5px)',
        lineHeight: '1.65',
      },
      '.cm-content': {
        caretColor: 'var(--nd-accent)',
        padding: '16px 0',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--nd-accent)' },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--nd-selection) !important',
      },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--nd-text-muted)',
        border: 'none',
      },
      '.cm-panels': {
        backgroundColor: 'var(--nd-surface)',
        color: 'var(--nd-text)',
      },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--nd-border)' },
      '.cm-searchMatch': {
        backgroundColor: 'color-mix(in srgb, var(--nd-warning) 26%, transparent)',
        outline: '1px solid color-mix(in srgb, var(--nd-warning) 45%, transparent)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'color-mix(in srgb, var(--nd-accent) 30%, transparent)',
      },
    }),
    syntaxHighlighting(highlightStyle),
  ]
}
