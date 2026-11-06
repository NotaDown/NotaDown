import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Produces the channel files served by the first-party metadata source
// (project.config.json) from already published releases. Upload the output to
// the bucket's `updater/` prefix.
//
// The stable channel (`latest*.yml`) always comes from a stable release. The
// alpha channel (`alpha*.yml`) holds the newest prerelease, so clients that
// opted into alpha checks can still see it when GitHub is unreachable. A
// stable release refreshes `latest*.yml` and keeps `alpha*.yml` pointed at the
// newest prerelease; a prerelease release refreshes `alpha*.yml` only.

const sourceFiles = ['latest.yml', 'latest-linux.yml']
const outDir = fileURLToPath(new URL('../update-metadata/', import.meta.url))
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { repository } = JSON.parse(
  readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'),
)
const repo = `${repository.owner}/${repository.repo}`

const tagIndex = process.argv.indexOf('--tag')
const tag = tagIndex === -1 ? `v${version}` : process.argv[tagIndex + 1]
if (!tag?.startsWith('v')) {
  console.error('Usage: pnpm update-metadata [--tag v1.2.3]')
  process.exit(1)
}

function assetBase(releaseTag) {
  return `https://github.com/${repo}/releases/download/${releaseTag}`
}

// The feed is newest-first, so the first prerelease tag is the newest one.
async function findLatestPrereleaseTag() {
  const response = await fetch(`https://github.com/${repo}/releases.atom`, {
    redirect: 'follow',
  })
  if (!response.ok) {
    console.error(`releases.atom: HTTP ${response.status}`)
    process.exit(1)
  }
  for (const match of (await response.text()).matchAll(
    /href="[^"]*\/releases\/tag\/([^"/]+)"/g,
  )) {
    const version = match[1].replace(/^v/, '')
    if (/^\d+\.\d+\.\d+-/.test(version)) return `v${version}`
  }
  return null
}

async function buildChannelFile(name, releaseTag) {
  const base = assetBase(releaseTag)
  const response = await fetch(`${base}/${name}`, { redirect: 'follow' })
  if (!response.ok) {
    console.error(`${name}: HTTP ${response.status} from ${base}/${name}`)
    process.exit(1)
  }
  const channel = await response.text()
  const published = /^version:\s*(\S+)\s*$/m.exec(channel)?.[1]
  if (published !== releaseTag.slice(1)) {
    console.error(`${name}: version ${published} does not match ${releaseTag}`)
    process.exit(1)
  }

  // The generic provider resolves relative URLs against the metadata base, so
  // the installers have to be pointed back at GitHub explicitly.
  const rewritten = channel.replace(/^( {2}- url:|path:) (.+)$/gm, (_, key, url) =>
    url.startsWith('http') ? `${key} ${url}` : `${key} ${base}/${url}`,
  )
  // A miss here would upload relative paths to a bucket that holds no
  // installers; the client would fail on COS and on every mirror.
  const unresolved = rewritten
    .split('\n')
    .find((line) => /^\s*(?:-\s+)?(?:url|path):\s+(?!https?:\/\/)/.test(line))
  if (unresolved) {
    console.error(`${name}: installer URL was not rewritten: ${unresolved.trim()}`)
    process.exit(1)
  }
  return rewritten
}

const targets = []
if (tag.includes('-')) {
  targets.push({ channel: 'alpha', tag })
} else {
  targets.push({ channel: 'latest', tag })
  const alphaTag = await findLatestPrereleaseTag()
  if (alphaTag) targets.push({ channel: 'alpha', tag: alphaTag })
  else console.log('No prerelease yet; leaving the alpha channel unchanged.')
}

// Only the files this run writes should reach the bucket.
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
for (const target of targets) {
  for (const name of sourceFiles) {
    const outputName = name.replace(/^latest/, target.channel)
    writeFileSync(
      path.join(outDir, outputName),
      await buildChannelFile(name, target.tag),
    )
    console.log(`${target.tag}/${name} -> update-metadata/${outputName}`)
  }
}

console.log('\nUpload the generated files to the updater/ prefix of the release bucket.')
