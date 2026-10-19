export interface FuzzyResult {
  score: number
  positions: number[]
}

export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (!query) return { score: 0, positions: [] }
  const queryLower = query.toLowerCase()
  const targetLower = target.toLowerCase()

  let queryIndex = 0
  let score = 0
  let consecutive = 0
  const positions: number[] = []

  for (let index = 0; index < targetLower.length && queryIndex < queryLower.length; index += 1) {
    if (targetLower[index] === queryLower[queryIndex]) {
      positions.push(index)
      queryIndex += 1
      score += 10 + consecutive * 8
      if (index === 0) score += 12
      const previous = targetLower[index - 1]
      if (previous === '/' || previous === '\\' || previous === '-' || previous === '_' || previous === ' ') {
        score += 10
      }
      consecutive += 1
    } else {
      consecutive = 0
      score -= 1
    }
  }

  if (queryIndex < queryLower.length) return null
  score -= Math.max(0, target.length - query.length)
  return { score, positions }
}

export function fuzzyFilter<T>(query: string, items: T[], key: (item: T) => string): T[] {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, result: fuzzyMatch(query, key(item)) }))
    .filter((entry) => entry.result !== null)
    .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0))
    .map((entry) => entry.item)
}
