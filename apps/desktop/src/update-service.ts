import {
  UPDATE_RELEASES_URL,
  type UpdateDownloadSource,
  type UpdateMetadataSource,
  type UpdateSnapshot,
  type UpdateUnsupportedReason,
} from '@notadown/shared'
import { UPDATE_MIRRORS } from './update-sources'

const MIRROR_PROBE_TIMEOUT_MS = 6000

// electron-updater has no short request timeout, so a blocked github.com makes
// its own check hang for a minute or more before failing. The channel is probed
// first so the first-party source takes over as soon as GitHub stops answering.
const GITHUB_PROBE_TIMEOUT_MS = 4000

// Mirrors the `publish` block in electron-builder.yml. setFeedURL has no
// "restore packaged config" form, so a metadata check swaps the feed back with
// these options afterwards.
const GITHUB_FEED = { provider: 'github', owner: 'NotaDown', repo: 'NotaDown' } as const

export interface UpdateFeedOptions {
  provider: 'github'
  owner: string
  repo: string
}

export interface UpdateInfoLike {
  version: string
  releaseNotes?: unknown
  releaseDate?: string | null
}

export interface UpdateFileLike {
  url: string
  sha512?: string
  size?: number
}

export interface UpdateInfoWithFilesLike extends UpdateInfoLike {
  files?: UpdateFileLike[]
}

export interface ResolvedUpdateFileLike {
  url: URL
  info: UpdateFileLike
  packageInfo?: { path: string; sha512?: string }
}

export interface UpdateProviderLike {
  resolveFiles(info: UpdateInfoLike): ResolvedUpdateFileLike[]
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
  setFeedURL?(options: string | UpdateFeedOptions): void
  updateInfoAndProvider?: {
    info: UpdateInfoWithFilesLike
    provider: UpdateProviderLike
  } | null
  disableDifferentialDownload?: boolean
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
  download(source?: UpdateDownloadSource): Promise<void>
  install(): void
}

export interface UpdateServiceOptions {
  metadataBaseUrl?: string | null
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

// Any HTTP answer counts as reachable: the probe only needs to tell "GitHub
// answers at all" from "the connection is black-holed".
async function githubAnswers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(GITHUB_PROBE_TIMEOUT_MS),
    })
    await response.body?.cancel().catch(() => undefined)
    return true
  } catch {
    return false
  }
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

function assetExtension(platform: string): string | null {
  if (platform === 'win32') return '.exe'
  if (platform === 'linux') return '.appimage'
  return null
}

function isAcceptableProbe(response: Response, expectedSize: number | null): boolean {
  if (response.status !== 200 && response.status !== 206) return false
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('text/html')) return false

  if (response.status === 200) {
    const length = Number(response.headers.get('content-length') ?? '')
    if (!Number.isFinite(length) || length <= 0) return false
    if (expectedSize !== null && length !== expectedSize) return false
  } else {
    const range = /bytes\s+0-0\/(\d+)/i.exec(
      response.headers.get('content-range') ?? '',
    )
    if (range && expectedSize !== null && Number(range[1]) !== expectedSize) return false
  }
  return true
}

async function probeMirror(
  mirror: string,
  assetUrl: string,
  expectedSize: number | null,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await fetch(`${mirror}/${assetUrl}`, {
    headers: { Range: 'bytes=0-0' },
    redirect: 'follow',
    signal,
  })
  try {
    return isAcceptableProbe(response, expectedSize)
  } finally {
    await response.body?.cancel().catch(() => undefined)
  }
}

function raceMirrors(
  assetUrl: string,
  expectedSize: number | null,
  excluded: Set<string>,
): Promise<string | null> {
  const candidates = UPDATE_MIRRORS.filter((mirror) => !excluded.has(mirror))
  if (candidates.length === 0) return Promise.resolve(null)

  return new Promise((resolve) => {
    let settled = false
    let remaining = candidates.length
    const controllers = candidates.map(() => new AbortController())
    const timer = setTimeout(() => finish(null), MIRROR_PROBE_TIMEOUT_MS)

    function finish(mirror: string | null): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      for (const controller of controllers) controller.abort()
      resolve(mirror)
    }

    candidates.forEach((mirror, index) => {
      probeMirror(mirror, assetUrl, expectedSize, controllers[index].signal)
        .then((accepted) => {
          if (accepted) finish(mirror)
          else if (--remaining === 0) finish(null)
        })
        .catch(() => {
          if (--remaining === 0) finish(null)
        })
    })
  })
}

export function createUpdateService(
  updater: UpdaterAdapter,
  runtime: UpdateRuntime,
  onChange: (snapshot: UpdateSnapshot) => void,
  options: UpdateServiceOptions = {},
): UpdateService {
  const unsupportedReason = getUnsupportedReason(runtime)
  const metadataBaseUrl =
    options.metadataBaseUrl?.trim().replace(/\/+$/, '') || null
  const canCheckMetadata = Boolean(metadataBaseUrl && updater.setFeedURL)
  const channelFile = runtime.platform === 'linux' ? 'latest-linux.yml' : 'latest.yml'
  const metadataChannelUrl = metadataBaseUrl ? `${metadataBaseUrl}/${channelFile}` : null
  // Same request GitHubProvider starts with, so a probe failure means its check
  // would fail too.
  const githubProbeUrl = `https://github.com/${GITHUB_FEED.owner}/${GITHUB_FEED.repo}/releases/latest`

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
    metadataSource: null,
    metadataUrl: null,
    downloadUrl: null,
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

  // While a fallback source is being tried, the updater's own error events are
  // the attempts that failed, not the outcome. Defer them until the last one.
  let fallbackActive = false
  let deferredError: string | null = null

  function resolveMirrorTarget(): { url: string; size: number | null } | null {
    const extension = assetExtension(runtime.platform)
    const update = updater.updateInfoAndProvider
    if (!extension || !update) return null
    try {
      const files = update.provider.resolveFiles(update.info)
      const file = files.find((entry) =>
        entry.url.pathname.toLowerCase().endsWith(extension),
      )
      if (!file) return null
      return {
        url: file.url.href,
        size: typeof file.info.size === 'number' ? file.info.size : null,
      }
    } catch {
      return null
    }
  }

  function applyMirror(mirror: string): (() => void) | null {
    const update = updater.updateInfoAndProvider
    if (!update) return null
    const provider = update.provider
    const original = provider.resolveFiles
    provider.resolveFiles = (info) =>
      original.call(provider, info).map((file) => {
        const resolved: ResolvedUpdateFileLike = {
          ...file,
          url: new URL(`${mirror}/${file.url.href}`),
        }
        if (file.packageInfo) {
          resolved.packageInfo = {
            ...file.packageInfo,
            path: `${mirror}/${file.packageInfo.path}`,
          }
        }
        return resolved
      })
    return () => {
      provider.resolveFiles = original
    }
  }

  async function downloadFromMirror(mirror: string): Promise<void> {
    const restore = applyMirror(mirror)
    if (!restore) throw new Error('NO_UPDATE_AVAILABLE')
    const differential = updater.disableDifferentialDownload
    // Proxies are not reliable for block-map range requests; a full download
    // is re-verified against the same SHA-512 from the GitHub channel file.
    updater.disableDifferentialDownload = true
    try {
      await updater.downloadUpdate()
    } finally {
      updater.disableDifferentialDownload = differential
      restore()
    }
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
    if (fallbackActive) {
      deferredError = errorMessage(error)
      return
    }
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

  async function checkFirstPartyMetadata(): Promise<UpdateCheckResultLike | null> {
    if (!metadataBaseUrl || !updater.setFeedURL) throw new Error('NO_METADATA_SOURCE')
    updater.setFeedURL(metadataBaseUrl)
    try {
      return await updater.checkForUpdates()
    } finally {
      // The channel file lists absolute GitHub asset URLs, so the installer
      // still comes from GitHub or, on failure, from the mirror fallback.
      updater.setFeedURL(GITHUB_FEED)
    }
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
      metadataSource: null,
      metadataUrl: null,
      downloadUrl: null,
    })

    fallbackActive = canCheckMetadata
    deferredError = null
    try {
      let result: UpdateCheckResultLike | null
      let metadataSource: UpdateMetadataSource = 'github'
      if (canCheckMetadata && !(await githubAnswers(githubProbeUrl))) {
        metadataSource = 'self-hosted'
        try {
          result = await checkFirstPartyMetadata()
        } catch (metadataError) {
          throw new Error(
            `GitHub is unreachable and the fallback update channel also failed: ${errorMessage(metadataError)}`,
          )
        }
      } else {
        try {
          result = await updater.checkForUpdates()
        } catch (githubError) {
          if (!canCheckMetadata) throw githubError
          patch({ status: 'checking', error: null })
          metadataSource = 'self-hosted'
          try {
            result = await checkFirstPartyMetadata()
          } catch {
            // The GitHub failure is the reason the user cannot update; the
            // metadata one is only a consequence of it.
            throw githubError
          }
        }
      }
      applyCheckResult(result)
      patch({
        metadataSource,
        metadataUrl: metadataSource === 'self-hosted' ? metadataChannelUrl : null,
        downloadUrl: state.status === 'available' ? resolveMirrorTarget()?.url ?? null : null,
      })
    } catch (error) {
      if (state.status !== 'error') {
        patch({ status: 'error', error: errorMessage(error) })
      }
    } finally {
      fallbackActive = false
      deferredError = null
    }
    return snapshot()
  }

  async function download(source: UpdateDownloadSource = 'auto'): Promise<void> {
    if (state.status === 'downloading' || state.status === 'downloaded') return
    if (state.status !== 'available') throw new Error('NO_UPDATE_AVAILABLE')

    const resolved = resolveMirrorTarget()
    patch({
      status: 'downloading',
      progress: 0,
      transferred: 0,
      total: null,
      bytesPerSecond: null,
      error: null,
      downloadUrl: resolved?.url ?? state.downloadUrl,
    })

    const target = source === 'auto' ? resolved : null
    // The update was found through the self-hosted channel because github.com
    // was unreachable at check time, so a direct attempt would only hang until
    // its own timeout before the mirrors get a chance.
    const skipDirect = target !== null && state.metadataSource === 'self-hosted'
    fallbackActive = target !== null
    deferredError = null

    try {
      let lastError: unknown = new Error(
        'GitHub is unreachable and no update mirror answered',
      )
      if (!skipDirect) {
        try {
          await updater.downloadUpdate()
          return
        } catch (directError) {
          if (!target) throw directError
          lastError = directError
        }
      }

      if (!target) throw lastError

      const tried = new Set<string>()
      while (true) {
        patch({
          status: 'downloading',
          progress: 0,
          transferred: 0,
          total: null,
          bytesPerSecond: null,
        })
        const mirror = await raceMirrors(target.url, target.size, tried)
        if (!mirror) throw lastError
        tried.add(mirror)
        patch({ downloadUrl: `${mirror}/${target.url}` })
        try {
          await downloadFromMirror(mirror)
          return
        } catch (error) {
          lastError = error
        }
      }
    } catch (error) {
      fallbackActive = false
      const message = deferredError ?? errorMessage(error)
      deferredError = null
      patch({
        status: 'error',
        error: message,
        progress: null,
        transferred: null,
        total: null,
        bytesPerSecond: null,
      })
      throw error
    } finally {
      fallbackActive = false
      deferredError = null
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
