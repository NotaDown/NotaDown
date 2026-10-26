export const BULLET_MARKERS = ['-', '*', '+'] as const

export type BulletMarker = (typeof BULLET_MARKERS)[number]

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const BLOCKQUOTE_PREFIX = /^(?: {0,3}> ?)+/
const THEMATIC_BREAK = /^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const BULLET_ITEM = /^[ \t]*([-*+])(?:[ \t]+|$)/

/**
 * Picks the bullet marker used by the source document so serialization keeps
 * its existing style. Falls back to `-` when the document has no unordered
 * lists or mixes markers without a clear majority.
 */
export function detectBulletMarker(markdown: string): BulletMarker {
  const counts = new Map<BulletMarker, number>()
  let fence: string | null = null

  for (const rawLine of markdown.split(/\r?\n/)) {
    const fenceMatch = FENCE.exec(rawLine)
    if (fenceMatch) {
      const char = fenceMatch[1][0]
      if (fence === null) fence = char
      else if (fence === char) fence = null
      continue
    }
    if (fence !== null) continue

    const line = rawLine.replace(BLOCKQUOTE_PREFIX, '')
    if (THEMATIC_BREAK.test(line)) continue

    const item = BULLET_ITEM.exec(line)
    if (!item) continue
    const marker = item[1] as BulletMarker
    counts.set(marker, (counts.get(marker) ?? 0) + 1)
  }

  let best: BulletMarker = '-'
  let bestCount = 0
  for (const marker of BULLET_MARKERS) {
    const count = counts.get(marker) ?? 0
    if (count > bestCount) {
      best = marker
      bestCount = count
    }
  }
  return best
}
