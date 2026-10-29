import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.resolve(fileURLToPath(import.meta.url), '../..')
const require = createRequire(import.meta.url)
const electronDir = path.dirname(require.resolve('electron/package.json'))

const pathFile = path.join(electronDir, 'path.txt')
const executable = existsSync(pathFile) ? readFileSync(pathFile, 'utf8').trim() : ''
if (executable && existsSync(path.join(electronDir, 'dist', executable))) process.exit(0)

// electron downloads its binary on first launch instead of at install time, and
// pnpm does not forward .npmrc to scripts, so the mirror only reaches
// @electron/get as an environment variable.
const mirror = process.env.ELECTRON_MIRROR || readNpmrc('electron_mirror')
console.log(`[desktop] Downloading Electron binary from ${mirror || 'github.com'}...`)

const result = spawnSync(process.execPath, [path.join(electronDir, 'install.js')], {
  stdio: 'inherit',
  env: mirror ? { ...process.env, ELECTRON_MIRROR: mirror } : process.env,
})
process.exit(result.status ?? 1)

function readNpmrc(key) {
  const file = path.resolve(appDir, '../../.npmrc')
  if (!existsSync(file)) return undefined
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`))
  return line?.slice(line.indexOf('=') + 1).trim()
}
