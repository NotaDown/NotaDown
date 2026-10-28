#!/usr/bin/env node
// Renders the README screenshot by driving the web app in headless Chrome over CDP:
// loads a demo workspace and documents into the Pinia stores, then captures the page.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..', '..')
const webDir = path.join(repoRoot, 'apps', 'web')
const defaultOut = path.join(repoRoot, 'docs', 'image', 'screenshot.png')
const profileDir = path.join(os.tmpdir(), 'notadown-readme-screenshot', 'profile')
const devServerUrl = 'http://127.0.0.1:5813/'
const port = 9333

function parseArgs(argv) {
  const options = {
    out: defaultOut,
    theme: 'paper',
    mode: 'light',
    scale: 2,
    width: 1600,
    height: 1000,
    scroll: 0,
    url: devServerUrl,
    chrome: undefined
  }
  const number = (name, value) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new Error(`${name} needs a number`)
    return parsed
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const value = argv[i + 1]
    switch (arg) {
      case '--out': options.out = path.resolve(value); i += 1; break
      case '--theme': options.theme = value; i += 1; break
      case '--mode': options.mode = value; i += 1; break
      case '--scale': options.scale = number(arg, value); i += 1; break
      case '--width': options.width = number(arg, value); i += 1; break
      case '--height': options.height = number(arg, value); i += 1; break
      case '--scroll': options.scroll = number(arg, value); i += 1; break
      case '--url': options.url = value; i += 1; break
      case '--chrome': options.chrome = value; i += 1; break
      case '--help':
      case '-h':
        console.log(
          'Usage: node examples/readme-screenshot/capture.mjs [--out <png>] [--theme <id>] [--mode <light|dark>]\n' +
          '       [--scale <n>] [--width <px>] [--height <px>] [--scroll <px>] [--url <url>] [--chrome <exe>]'
        )
        process.exit(0)
        break
      default:
        throw new Error(`unknown option: ${arg}`)
    }
  }
  return options
}

function findChrome(explicit) {
  if (explicit) return explicit
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error('Chrome not found — pass --chrome <exe> or set CHROME_PATH')
  return found
}

const options = parseArgs(process.argv.slice(2))
const chromePath = findChrome(options.chrome)

const QUIET = `# The Shape of Quiet Software

Most tools ask for attention before they earn it. Quiet software does the opposite: it recedes until the work itself fills the room.

> A good tool disappears in the hand. What remains is the page.

## A room with fewer edges

Writing is already difficult enough. The tool should not add to the difficulty, nor pretend that it can remove it. It should simply hold the page steady while the sentence finds its shape.

- [x] Open a document without choosing a mode
- [x] See structure, math and diagrams in place
- [ ] Finish the first draft

## The measure of a page

Seventy characters is a good line. A little more air between lines than you think you need, then \`max-width: 68ch\` and the patience to leave it alone.

A comfortable measure stays between $45$ and $75$ characters per line. Everything else is decoration.

Then leave the page alone.

## A map, not a manual

Some ideas arrive as shapes before they arrive as sentences. A diagram can hold them while the language catches up.

\`\`\`mermaid
flowchart LR
  Capture --> Shape --> Revise --> Share
\`\`\`

## What stays

The page should feel the same on Tuesday as it did on Monday. The same measure, the same quiet margins, the same file waiting on disk. Everything else is decoration.

A page is a promise that the thought will still be there when you return. $E = mc^2$ is a small reminder that even the largest ideas fit on a line.
`

const TYPO = `# Notes on Typography

Text should be read before it is noticed. The interface earns its keep by staying quiet.

## Measure

A comfortable line holds between 45 and 75 characters. Anything longer asks the eye to travel; anything shorter breaks the rhythm of the sentence.

## Rhythm

Line height is the breath of a page. Set it once, then leave it alone.
`

const INBOX = `# Inbox

- [ ] Reply to Mara about the field guide
- [ ] Book the train for Thursday
- [ ] Finish reading *The Craftsman*
- [ ] Sketch the new contents page
`

const ENTRIES = [
  { path: 'essays', name: 'essays', kind: 'directory' },
  { path: 'essays/Quiet Software.md', name: 'Quiet Software.md', kind: 'file' },
  { path: 'essays/The Reading Room.md', name: 'The Reading Room.md', kind: 'file' },
  { path: 'notes', name: 'notes', kind: 'directory' },
  { path: 'notes/Reading List.md', name: 'Reading List.md', kind: 'file' },
  { path: 'notes/Typography.md', name: 'Typography.md', kind: 'file' },
  { path: 'Inbox.md', name: 'Inbox.md', kind: 'file' },
  { path: 'README.md', name: 'README.md', kind: 'file' },
]

const docs = [
  ['Quiet Software.md', 'essays/Quiet Software.md', QUIET],
  ['Typography.md', 'notes/Typography.md', TYPO],
  ['Inbox.md', 'Inbox.md', INBOX],
]

const setupSource = `async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const settingsModule = await import('/src/stores/settings.ts');
  const workspaceModule = await import('/src/stores/workspace.ts');
  const tabsModule = await import('/src/stores/tabs.ts');
  const settings = settingsModule.useSettingsStore();
  for (let i = 0; i < 120 && !settings.loaded; i += 1) await sleep(50);
  settings.update({
    locale: 'en-US',
    theme: ${JSON.stringify(options.theme)},
    colorMode: ${JSON.stringify(options.mode)},
    fontSize: 17,
    lineHeight: 1.75,
    pageWidth: 'very-narrow',
    sidebarWidth: 286,
    showWordCount: true,
    focusMode: false,
    typewriterMode: false,
    autosave: false,
    spellcheck: false,
  });
  const workspace = workspaceModule.useWorkspaceStore();
  workspace.info = { id: 'webws-preview', name: 'field-notes', rootPath: null };
  workspace.entries = ${JSON.stringify(ENTRIES)};
  workspace.expandedDirs = new Set(['', 'essays', 'notes']);
  workspace.selectedPath = 'essays/Quiet Software.md';
  const tabs = tabsModule.useTabsStore();
  const opened = ${JSON.stringify(docs)}.map(([name, docPath, content]) => tabs.addOpenedDocument({
    ref: { key: 'webws-preview/' + docPath, name, path: docPath, origin: 'workspace' },
    content,
    mtime: Date.now(),
  }));
  tabs.activate(opened[0].key);
  for (let i = 0; i < 80; i += 1) {
    if (document.querySelector('.nd-editor .ProseMirror h1')) break;
    await sleep(100);
  }
  if (document.fonts?.ready) await document.fonts.ready;
  await sleep(1800);
  for (const tab of tabs.tabs) tab.savedContent = tab.content;
  const scroller = document.querySelector('.nd-editor');
  if (scroller) scroller.scrollTop = ${options.scroll};
  const style = document.createElement('style');
  style.textContent = 'header.topbar button[title*="Install"] { display: none !important; } .status-bar__platform { display: none !important; }';
  document.head.append(style);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  await sleep(500);
  return {
    locale: settings.locale,
    theme: document.documentElement.dataset.theme,
    mode: document.documentElement.dataset.colorMode,
    tabs: tabs.tabs.map((tab) => tab.name),
    viewport: [window.innerWidth, window.innerHeight],
    title: document.title,
  };
}`

async function reachable(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

let devServer
let devServerTail = ''
async function ensureDevServer() {
  if (await reachable(options.url)) return
  console.log('starting Vite dev server…')
  devServer = spawn(
    process.execPath,
    [path.join(webDir, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5813', '--strictPort'],
    { cwd: webDir, stdio: ['ignore', 'ignore', 'pipe'] }
  )
  devServer.stderr.on('data', (chunk) => {
    devServerTail = (devServerTail + String(chunk)).slice(-2000)
  })
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    if (await reachable(options.url)) return
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`dev server did not start${devServerTail ? `: ${devServerTail}` : ''}`)
}

async function waitForEndpoint() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) return await response.json()
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('Chrome DevTools endpoint did not start')
}

await ensureDevServer()
await fs.rm(profileDir, { recursive: true, force: true })
await fs.mkdir(path.dirname(options.out), { recursive: true })

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ],
  { stdio: 'ignore' }
)

try {
  const targets = await waitForEndpoint()
  const target = targets.find((item) => item.type === 'page')
  if (!target) throw new Error('no page target')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
    else entry.resolve(message.result)
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: options.width,
    height: options.height,
    deviceScaleFactor: options.scale,
    mobile: false,
    screenWidth: options.width,
    screenHeight: options.height
  })
  await send('Page.navigate', { url: options.url })
  await new Promise((resolve) => setTimeout(resolve, 2600))

  const result = await send('Runtime.evaluate', {
    expression: `(${setupSource})()`,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'demo setup failed')
  }

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  })
  await fs.writeFile(options.out, Buffer.from(shot.data, 'base64'))
  console.log(`saved ${options.out}`)
  ws.close()
} finally {
  chrome.kill()
  devServer?.kill()
  await new Promise((resolve) => setTimeout(resolve, 800))
  await fs.rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
}
