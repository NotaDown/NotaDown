import { describe, expect, it } from 'vitest'
import {
  buildImageFileName,
  extractHeadings,
  fuzzyMatch,
  joinFrontmatter,
  joinPosix,
  relativePosix,
  sanitizeFileName,
  searchText,
  splitFrontmatter,
} from '../src'

describe('searchText', () => {
  const content = '# Title\n\nHello World\n'

  it('finds content with line and preview metadata', () => {
    const results = searchText('notes/a.md', 'a.md', content, 'world')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      kind: 'content',
      line: 3,
      preview: 'Hello World',
      previewMatchStart: 6,
      previewMatchLength: 5,
    })
  })

  it('reports name-only matches without preview data', () => {
    const results = searchText('notes/a.md', 'a.md', content, 'a')
    expect(results).toEqual([{ path: 'notes/a.md', name: 'a.md', kind: 'name' }])
  })

  it('reports matches in both name and content', () => {
    const results = searchText('notes/hello.md', 'hello.md', content, 'hello')
    expect(results[0].kind).toBe('both')
  })

  it('respects case sensitivity', () => {
    expect(searchText('notes/a.md', 'a.md', content, 'hello', true)).toEqual([])
    expect(searchText('notes/a.md', 'a.md', content, 'Hello', true)).toHaveLength(1)
  })

  it('returns nothing for an empty query', () => {
    expect(searchText('notes/a.md', 'a.md', content, '')).toEqual([])
  })
})

describe('path helpers', () => {
  it('joins and normalizes posix segments', () => {
    expect(joinPosix('notes/../blog', './post.md')).toBe('blog/post.md')
    expect(relativePosix('notes/a', 'assets/x.png')).toBe('../../assets/x.png')
  })

  it('sanitizes file names', () => {
    expect(sanitizeFileName('a<b>:c*.md')).toBe('a-b--c-.md')
    expect(sanitizeFileName('...')).toBe('-')
  })
})

describe('image file names', () => {
  it('expands placeholders with the provided date', () => {
    const name = buildImageFileName(
      '${documentName}-${originalName}-${timestamp}-${date}-${time}',
      {
        documentName: 'note.md',
        originalName: 'photo.jpg',
        extension: 'png',
      },
      new Date(2026, 0, 2, 3, 4, 5),
    )
    expect(name).toBe('note-photo-20260102-030405-20260102-030405.png')
  })
})

describe('frontmatter and headings', () => {
  const document = '---\ntitle: Test\n---\n# One\n\n## Two\n'

  it('splits and rejoins frontmatter', () => {
    const parts = splitFrontmatter(document)
    expect(parts.frontmatter).toBe('---\ntitle: Test\n---\n')
    expect(parts.body).toBe('# One\n\n## Two\n')
    expect(joinFrontmatter(parts.frontmatter, parts.body)).toBe(document)
  })

  it('extracts headings with body-relative line numbers', () => {
    expect(extractHeadings(document)).toEqual([
      { level: 1, text: 'One', line: 1 },
      { level: 2, text: 'Two', line: 3 },
    ])
  })
})

describe('fuzzyMatch', () => {
  it('matches subsequences and reports positions', () => {
    expect(fuzzyMatch('nt', 'note')).toMatchObject({ positions: [0, 2] })
    expect(fuzzyMatch('zz', 'note')).toBeNull()
  })
})
