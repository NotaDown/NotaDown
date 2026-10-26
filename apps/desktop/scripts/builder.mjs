import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const rootPackage = JSON.parse(readFileSync(path.resolve(appDir, '../../package.json'), 'utf8'))

// When a release runs from a v* tag, refuse to package if the tag and the root
// version disagree (core plus prerelease must match exactly).
const refName = process.env.GITHUB_REF_NAME ?? ''
if (refName.startsWith('v')) {
  const split = (v) => {
    const [core, pre = ''] = v.replace(/^v/, '').split(/-(.*)/s)
    return { core, pre }
  }
  const tag = split(refName)
  const pkgVersion = split(rootPackage.version)
  if (tag.core !== pkgVersion.core || tag.pre !== pkgVersion.pre) {
    console.error(
      `Version mismatch: tag ${refName} does not match root package.json version ${rootPackage.version}`,
    )
    process.exit(1)
  }
}

// electron-builder refuses to package when package.json has no version, so the
// root version is injected for the build and the committed file stays free of it.
const pkgPath = path.join(appDir, 'package.json')
const original = readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(original)
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
writeFileSync(pkgPath, original)
process.exit(result.status ?? 1)
