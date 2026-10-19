import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { highlightSelectionMatches } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from '@codemirror/view'
import { createCodeMirrorTheme } from './codemirror-theme'
import type { SourceEditor, SourceEditorOptions } from './types'

export function createSourceEditor(options: SourceEditorOptions): SourceEditor {
  const readOnlyCompartment = new Compartment()
  let settingValue = false
  let currentValue = options.value
  let destroyed = false

  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return
    currentValue = update.state.doc.toString()
    if (settingValue) return
    options.onChange?.(currentValue)
  })

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      preventDefault: true,
      run: () => {
        options.onSave?.()
        return true
      },
    },
    indentWithTab,
  ])

  const blurListener = EditorView.domEventHandlers({
    blur: () => {
      options.onBlur?.()
    },
  })

  const phrases = EditorState.phrases.of({
    Find: options.labels.find.find,
    Replace: options.labels.find.replace,
    next: options.labels.find.next,
    previous: options.labels.find.previous,
    all: options.labels.find.all,
    'match case': options.labels.find.matchCase,
    'by word': options.labels.find.byWord,
    regexp: options.labels.find.regexp,
    replace: options.labels.find.replaceAction,
    'replace all': options.labels.find.replaceAll,
    close: options.labels.find.close,
  })

  const state = EditorState.create({
    doc: options.value,
    extensions: [
      saveKeymap,
      phrases,
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      ...(options.largeDocument
        ? []
        : [bracketMatching(), highlightSelectionMatches()]),
      rectangularSelection(),
      crosshairCursor(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        spellcheck: String(options.spellcheck ?? true),
      }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      createCodeMirrorTheme(),
      updateListener,
      blurListener,
      readOnlyCompartment.of(readOnlyExtensions(options.readOnly ?? false)),
    ],
  })

  const view = new EditorView({ state, parent: options.root })

  return {
    getValue: () => currentValue,
    setValue(value: string) {
      currentValue = value
      if (destroyed || view.state.doc.toString() === value) return
      settingValue = true
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
      settingValue = false
    },
    focus() {
      view.focus()
    },
    setReadOnly(value: boolean) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(readOnlyExtensions(value)),
      })
    },
    find(query, forward = true) {
      const needle = query.trim()
      if (!needle) return null
      const text = view.state.doc.toString()
      const haystack = text.toLowerCase()
      const lower = needle.toLowerCase()
      const matches: number[] = []
      let index = haystack.indexOf(lower)
      while (index !== -1) {
        matches.push(index)
        index = haystack.indexOf(lower, index + lower.length)
      }
      if (!matches.length) return null

      const selection = view.state.selection.main
      let matchIndex = -1
      if (forward) {
        matchIndex = matches.findIndex((start) => start >= selection.to)
        if (matchIndex < 0) matchIndex = 0
      } else {
        for (let i = matches.length - 1; i >= 0; i -= 1) {
          if (matches[i] + needle.length <= selection.from) {
            matchIndex = i
            break
          }
        }
        if (matchIndex < 0) matchIndex = matches.length - 1
      }

      const from = matches[matchIndex]
      const to = from + needle.length
      view.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true,
      })
      view.focus()
      return { index: matchIndex + 1, total: matches.length, from, to }
    },
    clearFind() {
      view.focus()
    },
    goToPosition(pos: number) {
      const position = Math.max(0, Math.min(pos, view.state.doc.length))
      view.dispatch({
        selection: { anchor: position },
        scrollIntoView: true,
      })
      view.focus()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      view.destroy()
    },
  }
}

function readOnlyExtensions(value: boolean) {
  return [EditorState.readOnly.of(value), EditorView.editable.of(!value)]
}
