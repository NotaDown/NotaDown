import { statSync } from 'node:fs'
import path from 'node:path'
import { openableFileArgs } from '@notadown/shared'

const pending: string[] = []

export function queueOpenFiles(candidates: string[], baseDir = process.cwd()): void {
  for (const candidate of openableFileArgs(candidates)) {
    const resolved = path.resolve(baseDir, candidate)
    try {
      if (!statSync(resolved).isFile()) continue
    } catch {
      continue
    }
    if (!pending.includes(resolved)) pending.push(resolved)
  }
}

export function takeOpenFiles(): string[] {
  return pending.splice(0, pending.length)
}
