import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const appDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const rootPackage = JSON.parse(readFileSync(path.resolve(appDir, '../../package.json'), 'utf8'))

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
