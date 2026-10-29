import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Produces the channel files served by the first-party metadata source
// (apps/desktop/src/update-sources.ts) from an already published release.
// Upload the output to the bucket's `updater/` prefix.

const repo = 'NotaDown/NotaDown'
const channelFiles = ['latest.yml', 'latest-linux.yml']
const outDir = fileURLToPath(new URL('../update-metadata/', import.meta.url))
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const tagIndex = process.argv.indexOf('--tag')
const tag = tagIndex === -1 ? `v${version}` : process.argv[tagIndex + 1]
if (!tag?.startsWith('v')) {
  console.error('Usage: pnpm update-metadata [--tag v1.2.3]')
  process.exit(1)
}

const assetBase = `https://github.com/${repo}/releases/download/${tag}`
mkdirSync(outDir, { recursive: true })

for (const name of channelFiles) {
  const response = await fetch(`${assetBase}/${name}`, { redirect: 'follow' })
  if (!response.ok) {
    console.error(`${name}: HTTP ${response.status} from ${assetBase}/${name}`)
    process.exit(1)
  }
  const channel = await response.text()
  const published = /^version:\s*(\S+)\s*$/m.exec(channel)?.[1]
  if (published !== tag.slice(1)) {
    console.error(`${name}: version ${published} does not match ${tag}`)
    process.exit(1)
  }

  // The generic provider resolves relative URLs against the metadata base, so
  // the installers have to be pointed back at GitHub explicitly.
  const rewritten = channel.replace(/^( {2}- url:|path:) (.+)$/gm, (_, key, url) =>
    url.startsWith('http') ? `${key} ${url}` : `${key} ${assetBase}/${url}`,
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
  writeFileSync(path.join(outDir, name), rewritten)
  console.log(`${name} -> update-metadata/${name}`)
}

console.log('\nUpload both files to the updater/ prefix of the release bucket.')
