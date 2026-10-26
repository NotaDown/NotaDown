import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const rootPackage = JSON.parse(readFileSync(path.resolve(appDir, '../../package.json'), 'utf8'))

// electron-builder embeds build/release-notes.md into latest*.yml, which is
// what the in-app updater shows. Keep it in sync with the current version.
const releaseNotesPath = path.join(appDir, 'build', 'release-notes.md')
const changelogPath = path.resolve(appDir, '../../CHANGELOG.md')
const heading = `## v${rootPackage.version}`
const lines = readFileSync(changelogPath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((line) => line.trim() === heading)
if (start === -1) {
  rmSync(releaseNotesPath, { force: true })
} else {
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i
      break
    }
  }
  const notes = lines.slice(start + 1, end).join('\n').trim()
  mkdirSync(path.dirname(releaseNotesPath), { recursive: true })
  writeFileSync(releaseNotesPath, `${notes}\n`)
}

// electron-builder refuses to package when package.json has no version, so the
// root version is injected here right before packaging; the committed file omits it.
const pkgPath = path.join(appDir, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const ordered = {}
for (const [key, value] of Object.entries(pkg)) {
  ordered[key] = value
  if (key === 'name') ordered.version = rootPackage.version
}
if (!('version' in ordered)) ordered.version = rootPackage.version
writeFileSync(pkgPath, `${JSON.stringify(ordered, null, 2)}\n`)

const cli = path.join(appDir, 'node_modules', 'electron-builder', 'cli.js')
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: appDir,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
