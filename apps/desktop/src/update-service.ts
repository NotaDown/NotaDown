import {
  UPDATE_RELEASES_URL,
  type UpdateSnapshot,
  type UpdateUnsupportedReason,
} from '@notadown/shared'

export interface UpdateInfoLike {
  version: string
  releaseNotes?: unknown
  releaseDate?: string | null
}

export interface UpdateProgressLike {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateCheckResultLike {
  updateInfo: UpdateInfoLike
}

export interface UpdaterAdapter {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  on(event: string, listener: (...args: never[]) => void): unknown
  checkForUpdates(): Promise<UpdateCheckResultLike | null>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdateRuntime {
  currentVersion: string
  platform: string
  isPackaged: boolean
  appImage: boolean
}

export interface UpdateService {
  getState(): UpdateSnapshot
  check(): Promise<UpdateSnapshot>
  download(): Promise<void>
  install(): void
}

export function getUnsupportedReason(
  runtime: UpdateRuntime,
): UpdateUnsupportedReason | null {
  if (!runtime.isPackaged) return 'development'
  if (runtime.platform === 'win32') return null
  if (runtime.platform === 'linux' && runtime.appImage) return null
  return 'platform'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeReleaseNotes(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (!Array.isArray(value)) return null
  const parts = value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && 'note' in entry) {
        const note = (entry as { note?: unknown }).note
        return typeof note === 'string' ? note.trim() : ''
      }
      return ''
    })
    .filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}

export function createUpdateService(
  updater: UpdaterAdapter,
  runtime: UpdateRuntime,
  onChange: (snapshot: UpdateSnapshot) => void,
): UpdateService {
  const unsupportedReason = getUnsupportedReason(runtime)

  let state: UpdateSnapshot = {
    status: unsupportedReason ? 'unsupported' : 'idle',
    currentVersion: runtime.currentVersion,
    version: null,
    releaseNotes: null,
    releaseDate: null,
    progress: null,
    transferred: null,
    total: null,
    bytesPerSecond: null,
    error: null,
    reason: unsupportedReason,
    manualDownloadUrl: UPDATE_RELEASES_URL,
  }

  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  updater.allowPrerelease = runtime.currentVersion.includes('-')

  function snapshot(): UpdateSnapshot {
    return { ...state }
  }

  function patch(next: Partial<UpdateSnapshot>): void {
    state = { ...state, ...next }
    onChange(snapshot())
  }

  updater.on('update-available', (info: UpdateInfoLike) => {
    patch({
      status: 'available',
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      progress: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      error: null,
    })
  })

  updater.on('update-not-available', (info: UpdateInfoLike) => {
    patch({
      status: 'not-available',
      version: info?.version ?? null,
      releaseNotes: null,
      releaseDate: null,
      progress: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      error: null,
    })
  })

  updater.on('download-progress', (progress: UpdateProgressLike) => {
    patch({
      status: 'downloading',
      progress: Math.max(0, Math.min(1, progress.percent / 100)),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  updater.on('update-downloaded', (info: UpdateInfoLike) => {
    patch({
      status: 'downloaded',
      version: info.version,
      releaseNotes:
        normalizeReleaseNotes(info.releaseNotes) ?? state.releaseNotes,
      progress: 1,
      error: null,
    })
  })

  updater.on('error', (error: Error) => {
    patch({
      status: 'error',
      error: errorMessage(error),
      progress: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
    })
  })

  function applyCheckResult(result: UpdateCheckResultLike | null): void {
    if (state.status !== 'checking') return
    const info = result?.updateInfo
    if (info?.version && info.version !== runtime.currentVersion) {
      patch({
        status: 'available',
        version: info.version,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate ?? null,
      })
      return
    }
    patch({ status: 'not-available', version: info?.version ?? null })
  }

  async function check(): Promise<UpdateSnapshot> {
    if (unsupportedReason) {
      patch({ status: 'unsupported', reason: unsupportedReason })
      return snapshot()
    }
    if (
      state.status === 'checking' ||
      state.status === 'downloading' ||
      state.status === 'downloaded'
    ) {
      return snapshot()
    }

    patch({
      status: 'checking',
      version: null,
      releaseNotes: null,
      releaseDate: null,
      progress: null,
      transferred: null,
      total: null,
      bytesPerSecond: null,
      error: null,
    })

    try {
      const result = await updater.checkForUpdates()
      applyCheckResult(result)
    } catch (error) {
      if (state.status !== 'error') {
        patch({ status: 'error', error: errorMessage(error) })
      }
    }
    return snapshot()
  }

  async function download(): Promise<void> {
    if (state.status === 'downloading' || state.status === 'downloaded') return
    if (state.status !== 'available') throw new Error('NO_UPDATE_AVAILABLE')

    patch({
      status: 'downloading',
      progress: 0,
      transferred: 0,
      total: null,
      bytesPerSecond: null,
      error: null,
    })

    try {
      await updater.downloadUpdate()
    } catch (error) {
      patch({ status: 'error', error: errorMessage(error) })
      throw error
    }
  }

  function install(): void {
    if (state.status !== 'downloaded') throw new Error('NO_UPDATE_DOWNLOADED')
    updater.quitAndInstall(false, true)
  }

  return {
    getState: snapshot,
    check,
    download,
    install,
  }
}
