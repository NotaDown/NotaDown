import { createSearchPreview } from './markdown'

export function searchText(
  path: string,
  fileName: string,
  content: string,
  query: string,
  caseSensitive = false,
): import('../types').SearchResult[] {
  if (!query) return []
  const haystackName = caseSensitive ? fileName : fileName.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const nameMatches = haystackName.includes(needle)
  const searchable = caseSensitive ? content : content.toLowerCase()
  const contentIndex = searchable.indexOf(needle)

  if (contentIndex === -1) {
    if (!nameMatches) return []
    return [{ path, name: fileName, kind: 'name' }]
  }

  const preview = createSearchPreview(content, contentIndex, query.length)
  return [
    {
      path,
      name: fileName,
      kind: nameMatches ? 'both' : 'content',
      line: preview.line,
      preview: preview.preview,
      previewMatchStart: preview.matchStart,
      previewMatchLength: preview.matchLength,
    },
  ]
}
