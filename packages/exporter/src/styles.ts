/// <reference path="./shims.d.ts" />
import katexCss from 'katex/dist/katex.min.css?raw'
import {
  getThemeTokens,
  themeTokensToCss,
  type ThemeId,
} from '@notadown/shared'

export function buildDocumentCss(theme: ThemeId, mode: 'light' | 'dark'): string {
  const tokens = getThemeTokens(theme, mode)
  const variables = Object.entries(themeTokensToCss(tokens))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  return `:root {
${variables}
  color-scheme: ${mode};
}

${katexCss}

* {
  box-sizing: border-box;
}

html {
  background: var(--nd-bg);
}

body {
  margin: 0;
  background: var(--nd-bg);
  color: var(--nd-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.72;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.nd-export {
  max-width: 820px;
  margin: 0 auto;
  padding: 56px 32px 96px;
  overflow-wrap: break-word;
}

.nd-export > *:first-child {
  margin-top: 0;
}

.nd-export > *:last-child {
  margin-bottom: 0;
}

h1, h2, h3, h4, h5, h6 {
  margin: 1.6em 0 0.65em;
  font-weight: 650;
  line-height: 1.3;
  color: var(--nd-text);
}

h1 { font-size: 2em; }
h2 { font-size: 1.55em; padding-bottom: 0.3em; border-bottom: 1px solid var(--nd-border); }
h3 { font-size: 1.3em; }
h4 { font-size: 1.12em; }
h5 { font-size: 1em; }
h6 { font-size: 0.92em; color: var(--nd-text-secondary); }

p, ul, ol, dl {
  margin: 0 0 1em;
}

ul, ol {
  padding-left: 1.6em;
}

li > ul, li > ol {
  margin: 0.25em 0;
}

li + li {
  margin-top: 0.25em;
}

a {
  color: var(--nd-accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

strong {
  font-weight: 650;
}

del {
  color: var(--nd-text-secondary);
}

hr {
  height: 0;
  margin: 2em 0;
  border: 0;
  border-top: 1px solid var(--nd-border);
}

blockquote {
  margin: 1.2em 0;
  padding: 0.5em 1.2em;
  border-left: 3px solid var(--nd-border-strong);
  background: var(--nd-surface);
  color: var(--nd-text-secondary);
}

blockquote > *:last-child {
  margin-bottom: 0;
}

code {
  padding: 0.15em 0.4em;
  border: 1px solid var(--nd-code-border);
  border-radius: 4px;
  background: var(--nd-code-bg);
  color: var(--nd-inline-code);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.875em;
}

pre {
  margin: 1.2em 0;
  padding: 16px 18px;
  overflow-x: auto;
  border: 1px solid var(--nd-code-border);
  border-radius: 8px;
  background: var(--nd-code-bg);
  line-height: 1.55;
}

pre code {
  display: inline;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--nd-text);
  font-size: 0.875em;
  white-space: pre;
}

table {
  width: 100%;
  margin: 1.2em 0;
  border-collapse: collapse;
  font-size: 0.95em;
}

th, td {
  padding: 8px 12px;
  border: 1px solid var(--nd-border);
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--nd-surface);
  font-weight: 650;
}

tbody tr:nth-child(even) {
  background: var(--nd-bg-elevated);
}

ul.contains-task-list {
  padding-left: 1.6em;
}

li.task-list-item {
  list-style: none;
}

li.task-list-item > input[type="checkbox"] {
  margin: 0 0.45em 0 -1.4em;
  vertical-align: middle;
}

.katex-display {
  margin: 1.2em 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.2em 0;
}

.nd-mermaid {
  margin: 1.4em 0;
  text-align: center;
}

.nd-mermaid svg {
  max-width: 100%;
  height: auto;
}

.nd-mermaid-error,
.nd-math-error {
  border: 1px solid var(--nd-danger);
  border-radius: 6px;
  background: var(--nd-surface);
  color: var(--nd-danger);
}

.nd-mermaid-error {
  padding: 12px 16px;
  text-align: left;
}

.nd-mermaid-error pre {
  margin: 0.6em 0 0;
  border-color: var(--nd-code-border);
  color: var(--nd-text-secondary);
}

.nd-math-error {
  padding: 0.15em 0.4em;
  font-size: 0.9em;
}

.hljs {
  background: transparent;
  color: var(--nd-text);
}

.hljs-comment,
.hljs-quote {
  color: var(--nd-syn-comment);
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-doctag,
.hljs-name {
  color: var(--nd-syn-keyword);
}

.hljs-string,
.hljs-regexp,
.hljs-addition,
.hljs-attribute,
.hljs-meta .hljs-string {
  color: var(--nd-syn-string);
}

.hljs-number,
.hljs-symbol,
.hljs-bullet,
.hljs-link {
  color: var(--nd-syn-number);
}

.hljs-title,
.hljs-title.function_,
.hljs-section {
  color: var(--nd-syn-function);
}

.hljs-variable,
.hljs-template-variable,
.hljs-attr,
.hljs-property,
.hljs-params {
  color: var(--nd-syn-variable);
}

.hljs-built_in,
.hljs-type,
.hljs-title.class_ {
  color: var(--nd-syn-type);
}

.hljs-operator,
.hljs-selector-attr,
.hljs-selector-class,
.hljs-selector-id {
  color: var(--nd-syn-operator);
}

.hljs-meta {
  color: var(--nd-text-muted);
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: 700;
}

mark {
  background: var(--nd-selection);
  color: inherit;
}

@media print {
  .nd-export {
    max-width: none;
    padding: 0;
  }

  pre,
  blockquote,
  table,
  img,
  .nd-mermaid {
    break-inside: avoid;
  }

  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
  }
}
`
}
