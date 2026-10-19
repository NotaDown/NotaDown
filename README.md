<p align="right">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="design/logo/notadown-icon.svg" width="128" height="128" alt="NotaDown logo">
</p>

<h1 align="center">NotaDown</h1>

<p align="center"><em>An offline-first Markdown editor inspired by distraction-free writing.</em></p>

NotaDown is a Markdown editor where writing and rendering share one surface. Formatting, math, diagrams and images appear in place while you type, with no source and preview split. Everything stays on your disk.

## Features

- Single-surface WYSIWYG editing built on Milkdown, with a full-document source mode when you need it.
- Folder workspaces with tabs, drag-to-move, external change detection, global search and a document outline.
- Autosave, manual save, per-tab save state and silent local version history for recovery.
- Code highlighting, tables, task lists, KaTeX math and Mermaid diagrams.
- Images stored next to the document, in a global attachments folder or embedded as data URLs.
- Four preset themes, light and dark color modes, custom CSS, focus mode and typewriter mode.
- Export to standalone HTML or PDF.
- English and Simplified Chinese UI.
- Web and desktop editions from the same codebase.
- A native system title bar or an integrated desktop header, configurable in settings.

## Requirements

- Node.js 22 or newer
- pnpm 12

## Development

```bash
pnpm install

# Web edition
pnpm dev

# Desktop edition with hot reload
pnpm dev:desktop
```

The dev server runs at `http://127.0.0.1:5813` for both the web edition and the desktop renderer.

Type checking and tests:

```bash
pnpm typecheck
pnpm test
```

## Building

```bash
# Web build (apps/web/dist)
pnpm build

# Desktop renderer and unpacked app (apps/desktop/release)
pnpm build:desktop

# Desktop installers
pnpm package:desktop
```

## Project structure

| Package | Purpose |
| --- | --- |
| `apps/web` | Vue 3 application shell and editor workspace |
| `apps/desktop` | Electron main process, preload bridge and packaging |
| `packages/shared` | Shared types, settings, shortcuts and utilities |
| `packages/editor` | Milkdown editor, commands, math, Mermaid and styles |
| `packages/platform` | Platform abstraction for web and desktop |
| `packages/exporter` | Standalone HTML and PDF document rendering |
| `packages/i18n` | Locale definitions and language detection |

## Browser support

Folder workspaces use the File System Access API and require a Chromium-based browser on desktop. Other browsers can open individual files, keep drafts locally and export through the print dialog. The desktop edition has no such limitations.

## Data and privacy

NotaDown has no accounts, telemetry or remote storage. Documents, settings and version history stay on the machine. In the web edition they live in the browser's IndexedDB; in the desktop edition they live in the application data directory. Remote images referenced by a document are loaded from their original URLs.

## License

[MIT](./LICENSE)
