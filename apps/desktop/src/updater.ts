import { readFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateSnapshot } from '@notadown/shared'
import {
  createUpdateService,
  type UpdaterAdapter,
  type UpdateService,
} from './update-service'

// The desktop package omits its version in source and gets it injected at
// packaging time, so app.getVersion() reports Electron's version in dev.
function resolveCurrentVersion(): string {
  if (app.isPackaged) return app.getVersion()
  try {
    const rootPackage = JSON.parse(
      readFileSync(path.join(app.getAppPath(), '../../package.json'), 'utf8'),
    ) as { version?: string }
    return rootPackage.version ?? app.getVersion()
  } catch {
    return app.getVersion()
  }
}

export function createDesktopUpdateService(
  onChange: (snapshot: UpdateSnapshot) => void,
): UpdateService {
  return createUpdateService(
    autoUpdater as unknown as UpdaterAdapter,
    {
      currentVersion: resolveCurrentVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      appImage: Boolean(process.env.APPIMAGE),
    },
    onChange,
  )
}
