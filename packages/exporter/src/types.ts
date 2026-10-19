import type { ThemeId } from '@notadown/shared'

export interface ExportDocumentOptions {
  title: string
  theme: ThemeId
  mode: 'light' | 'dark'
  lang?: string
  resolveImage?: (src: string) => Promise<string | null>
}
