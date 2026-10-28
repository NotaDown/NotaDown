import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  generateMarkDown,
  getCurrentGitRef,
  getGitDiff,
  loadChangelogConfig,
  parseCommits,
} from 'changelogen'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const changelogPath = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url))
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout.trim()
const gitRefExists = (ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd }).status === 0
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : ''

if (new RegExp(`^## v${escapeRegExp(version)}\\s*$`, 'm').test(changelog)) {
  console.error(`CHANGELOG.md already contains v${version}; delete that section before regenerating`)
  process.exit(1)
}

// Start from the newest version that has both a CHANGELOG section and a tag, so commits tagged without a section are
// never skipped. The pattern stops at the first hyphen, so a prerelease section (`## v0.2.0-beta.1`) never matches a
// tag: the anchor stays on the last stable release, and every prerelease plus the final release describe the whole
// unreleased range.
const from =
  [...changelog.matchAll(/^##\s+(v?[\d.]+)/gm)]
    .map((match) => match[1])
    .find((tag) => gitRefExists(tag)) ||
  // The fallback skips prerelease tags too, otherwise the final release would only describe its last prerelease.
  git(['tag', '--sort=-creatordate'])
    .split(/\r?\n/)
    .find((tag) => tag !== '' && !tag.includes('-')) ||
  git(['rev-list', '--max-parents=0', 'HEAD'])

const config = await loadChangelogConfig(cwd, {
  from,
  to: await getCurrentGitRef(cwd),
  newVersion: version,
})

// changelogen drops chore(deps)/chore(release) on its own; inclusion is decided solely by the types in the config.
// Revert subjects re-quote the original title (parsed under the original type), which would read as a duplicate entry.
const commits = parseCommits(await getGitDiff(config.from, config.to, cwd), config)
  .map((commit) => ({ ...commit, type: commit.type.toLowerCase() }))
  .filter((commit) => config.types[commit.type] && !commit.message.startsWith('Revert "'))

// changelogen pads both sides of the release heading with a blank line, which renders as two empty lines under it
const markdown = (await generateMarkDown(commits, config))
  .trim()
  .replace(/(^## .+)\n{3,}/gm, '$1\n\n')
const defaultHeader = '# Changelog\n\nEnglish is canonical; entries are generated from conventional commits by `pnpm changelog`.'
const firstEntry = changelog.match(/^#{2,3}\s+.*$/m)
const prefix = firstEntry ? changelog.slice(0, firstEntry.index) : changelog
// Earlier sections stay in the file: CHANGELOG.md is the whole release history, not just the newest entry.
const earlier = firstEntry ? `\n\n${changelog.slice(firstEntry.index).trimEnd()}\n` : ''
const updated = `${(prefix.trim() || defaultHeader)}\n\n${markdown}\n${earlier}`

writeFileSync(changelogPath, updated)
console.log(`Wrote section v${version} (${config.from}...${config.to}, ${commits.length} commits)`)
