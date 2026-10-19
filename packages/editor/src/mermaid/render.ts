let renderCounter = 0

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, code: string) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>
}

let mermaidPromise: Promise<MermaidApi> | null = null

function isDarkMode(): boolean {
  const mode = document.documentElement.dataset.colorMode
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

async function loadMermaid(dark: boolean): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default as MermaidApi)
  const mermaid = await mermaidPromise
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'default',
    fontFamily: getComputedStyle(document.body).fontFamily || 'sans-serif',
    flowchart: { useMaxWidth: true },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
  })
  return mermaid
}

export interface MermaidResult {
  svg: string
  bind?: (el: Element) => void
}

export async function renderMermaid(code: string): Promise<MermaidResult> {
  const mermaid = await loadMermaid(isDarkMode())
  const id = `notadown-mermaid-${++renderCounter}`
  try {
    const result = await mermaid.render(id, code)
    return { svg: result.svg, bind: result.bindFunctions }
  } catch (error) {
    document.getElementById(id)?.remove()
    throw error
  }
}
