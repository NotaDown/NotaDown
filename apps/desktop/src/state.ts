import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppSettings, SessionState } from '@notadown/shared'

const SETTINGS_FILE = 'settings.json'
const SESSION_FILE = 'session.json'

function resolveFile(name: string): string {
  return path.join(app.getPath('userData'), name)
}

async function readJson<T>(name: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(resolveFile(name), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null
  } catch {
    return null
  }
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const target = resolveFile(name)
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.tmp`
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(temp, target)
}

export function loadSettings(): Promise<Partial<AppSettings> | null> {
  return readJson<Partial<AppSettings>>(SETTINGS_FILE)
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(SETTINGS_FILE, settings)
}

export function loadSession(): Promise<SessionState | null> {
  return readJson<SessionState>(SESSION_FILE)
}

export async function saveSession(session: SessionState): Promise<void> {
  await writeJson(SESSION_FILE, session)
}
