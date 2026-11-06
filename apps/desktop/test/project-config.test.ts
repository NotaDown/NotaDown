import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GITHUB_REPO_URL, PROJECT_REPOSITORY } from '@notadown/shared'

function readText(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

describe('project.config.json', () => {
  it('matches the publish block electron-builder reads', () => {
    const builderConfig = readText('../electron-builder.yml')

    expect(builderConfig).toContain(
      [
        'publish:',
        '  provider: github',
        `  owner: ${PROJECT_REPOSITORY.owner}`,
        `  repo: ${PROJECT_REPOSITORY.repo}`,
      ].join('\n'),
    )
  })

  it('matches the repository shown by the web settings dialog', () => {
    const packageJson = JSON.parse(readText('../package.json')) as { homepage?: string }

    expect(packageJson.homepage).toBe(GITHUB_REPO_URL)
  })
})
