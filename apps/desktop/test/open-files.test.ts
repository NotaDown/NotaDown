import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { queueOpenFiles, takeOpenFiles } from '../src/open-files'

let baseDir = ''

beforeEach(() => {
  takeOpenFiles()
  baseDir = mkdtempSync(path.join(tmpdir(), 'notadown-open-'))
  writeFileSync(path.join(baseDir, 'note.md'), '# Note')
  writeFileSync(path.join(baseDir, 'my note.md'), '# Spaced')
  writeFileSync(path.join(baseDir, 'image.png'), 'png')
  mkdirSync(path.join(baseDir, 'sub'))
  writeFileSync(path.join(baseDir, 'sub', 'other.markdown'), '# Other')
  mkdirSync(path.join(baseDir, 'folder'))
})

afterEach(() => {
  takeOpenFiles()
  rmSync(baseDir, { recursive: true, force: true })
})

describe('queueOpenFiles', () => {
  it('queues Markdown files and resolves relative paths against the base directory', () => {
    queueOpenFiles(['note.md', 'sub/other.markdown'], baseDir)

    expect(takeOpenFiles()).toEqual([
      path.resolve(baseDir, 'note.md'),
      path.resolve(baseDir, 'sub', 'other.markdown'),
    ])
  })

  it('ignores unsupported, missing and directory arguments', () => {
    queueOpenFiles(['image.png', 'missing.md', 'folder', '--inspect'], baseDir)

    expect(takeOpenFiles()).toEqual([])
  })

  it('keeps absolute paths as they are', () => {
    const absolute = path.join(baseDir, 'sub', 'other.markdown')
    queueOpenFiles([absolute], baseDir)

    expect(takeOpenFiles()).toEqual([absolute])
  })

  it('opens file URLs passed by Linux desktop launchers', () => {
    const spaced = path.join(baseDir, 'my note.md')
    queueOpenFiles([pathToFileURL(spaced).href], baseDir)

    expect(takeOpenFiles()).toEqual([spaced])
  })

  it('queues each file once', () => {
    queueOpenFiles(['note.md', 'note.md', './note.md'], baseDir)

    expect(takeOpenFiles()).toEqual([path.resolve(baseDir, 'note.md')])
  })
})

describe('takeOpenFiles', () => {
  it('drains queued paths', () => {
    queueOpenFiles(['note.md'], baseDir)
    takeOpenFiles()
    queueOpenFiles(['sub/other.markdown'], baseDir)

    expect(takeOpenFiles()).toEqual([path.resolve(baseDir, 'sub', 'other.markdown')])
    expect(takeOpenFiles()).toEqual([])
  })
})
