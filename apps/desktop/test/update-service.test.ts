import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateSnapshot } from '@notadown/shared'
import {
  createUpdateService,
  getUnsupportedReason,
  type UpdateCheckResultLike,
  type UpdaterAdapter,
  type UpdateRuntime,
} from '../src/update-service'

class FakeUpdater implements UpdaterAdapter {
  autoDownload = true
  autoInstallOnAppQuit = false
  allowPrerelease = false
  updateInfoAndProvider: UpdaterAdapter['updateInfoAndProvider'] = null
  disableDifferentialDownload = false
  checkForUpdates = vi.fn<() => Promise<UpdateCheckResultLike | null>>(async () => null)
  downloadUpdate = vi.fn<() => Promise<unknown>>(async () => undefined)
  quitAndInstall = vi.fn<(isSilent?: boolean, isForceRunAfter?: boolean) => void>()
  setFeedURL = vi.fn<(options: string | { provider: 'github'; owner: string; repo: string }) => void>()

  private listeners = new Map<string, ((...args: never[]) => void)[]>()

  on(event: string, listener: (...args: never[]) => void): this {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
    return this
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      ;(listener as (value: unknown) => void)(payload)
    }
  }
}

const runtime = (overrides: Partial<UpdateRuntime> = {}): UpdateRuntime => ({
  currentVersion: '1.2.3',
  platform: 'win32',
  isPackaged: true,
  appImage: false,
  ...overrides,
})

function setup(
  overrides: Partial<UpdateRuntime> = {},
  options: { metadataBaseUrl?: string } = {},
) {
  const updater = new FakeUpdater()
  const events: UpdateSnapshot[] = []
  const service = createUpdateService(
    updater,
    runtime(overrides),
    (snapshot) => {
      events.push(snapshot)
    },
    options,
  )
  return { updater, service, events }
}

function provideUpdateFiles(updater: FakeUpdater, version = '1.3.0'): void {
  updater.updateInfoAndProvider = {
    info: {
      version,
      files: [
        {
          url: `NotaDown.${version}-x64.exe`,
          sha512: 'github-checksum',
          size: 1000,
        },
      ],
    },
    provider: {
      resolveFiles: (info) =>
        (info.files ?? []).map((file) => ({
          url: new URL(
            `https://github.com/NotaDown/NotaDown/releases/download/v${version}/${file.url}`,
          ),
          info: file,
        })),
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getUnsupportedReason', () => {
  it('reports development builds', () => {
    expect(getUnsupportedReason(runtime({ isPackaged: false }))).toBe('development')
  })

  it('supports packaged Windows and Linux AppImage only', () => {
    expect(getUnsupportedReason(runtime())).toBeNull()
    expect(getUnsupportedReason(runtime({ platform: 'linux', appImage: true }))).toBeNull()
    expect(getUnsupportedReason(runtime({ platform: 'linux' }))).toBe('platform')
    expect(getUnsupportedReason(runtime({ platform: 'darwin' }))).toBe('platform')
  })
})

describe('createUpdateService', () => {
  it('configures the updater and starts unsupported in development', async () => {
    const { updater, service } = setup({ isPackaged: false })

    expect(updater.autoDownload).toBe(false)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(service.getState()).toMatchObject({
      status: 'unsupported',
      reason: 'development',
      currentVersion: '1.2.3',
    })

    const state = await service.check()
    expect(state.status).toBe('unsupported')
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('follows the prerelease channel of the current version', () => {
    expect(setup({ currentVersion: '1.0.0-alpha.1' }).updater.allowPrerelease).toBe(true)
    expect(setup().updater.allowPrerelease).toBe(false)
  })

  it('marks an available update from the event payload', async () => {
    const { updater, service, events } = setup()
    updater.checkForUpdates.mockImplementation(async () => {
      updater.emit('update-available', {
        version: '1.3.0',
        releaseNotes: 'Fixed things',
        releaseDate: '2026-10-01T00:00:00.000Z',
      })
      return null
    })

    const state = await service.check()

    expect(state).toMatchObject({
      status: 'available',
      version: '1.3.0',
      releaseNotes: 'Fixed things',
      releaseDate: '2026-10-01T00:00:00.000Z',
      metadataSource: 'github',
      metadataUrl: null,
      downloadUrl: null,
    })
    expect(events.map((event) => event.status)).toEqual([
      'checking',
      'available',
      'available',
    ])
    expect(events.at(-1)).toMatchObject({ metadataSource: 'github' })
  })

  it('records the planned download address from the update files', async () => {
    const { updater, service } = setup(
      {},
      { metadataBaseUrl: 'https://updates.example.test' },
    )
    provideUpdateFiles(updater)
    updater.checkForUpdates.mockImplementation(async () => {
      updater.emit('update-available', { version: '1.3.0' })
      return null
    })

    const state = await service.check()

    expect(state).toMatchObject({
      status: 'available',
      metadataSource: 'github',
      downloadUrl:
        'https://github.com/NotaDown/NotaDown/releases/download/v1.3.0/NotaDown.1.3.0-x64.exe',
    })
  })

  it('falls back to the check result when no event fires', async () => {
    const { updater, service } = setup()
    updater.checkForUpdates.mockResolvedValue({
      updateInfo: {
        version: '1.3.0',
        releaseNotes: [{ note: 'First' }, { note: 'Second' }],
      },
    })

    const state = await service.check()

    expect(state.status).toBe('available')
    expect(state.releaseNotes).toBe('First\n\nSecond')
  })

  it('reports up-to-date versions as not available', async () => {
    const { updater, service } = setup()
    updater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.2.3' } })

    const state = await service.check()

    expect(state.status).toBe('not-available')
    expect(state.version).toBe('1.2.3')
  })

  it('surfaces check failures and updater errors', async () => {
    const failing = setup()
    failing.updater.checkForUpdates.mockRejectedValue(new Error('offline'))
    expect((await failing.service.check()).error).toBe('offline')

    const emitted = setup()
    emitted.updater.emit('error', new Error('bad signature'))
    expect(emitted.service.getState()).toMatchObject({
      status: 'error',
      error: 'bad signature',
    })
  })

  it('checks the first-party metadata when GitHub is unreachable', async () => {
    const { updater, service, events } = setup(
      {},
      { metadataBaseUrl: 'https://updates.example.test/' },
    )
    updater.checkForUpdates
      .mockImplementationOnce(async () => {
        updater.emit('error', new Error('getaddrinfo ENOTFOUND github.com'))
        throw new Error('getaddrinfo ENOTFOUND github.com')
      })
      .mockImplementationOnce(async () => {
        updater.emit('update-available', { version: '1.3.0' })
        return null
      })

    const state = await service.check()

    expect(updater.setFeedURL).toHaveBeenNthCalledWith(1, 'https://updates.example.test')
    expect(updater.setFeedURL).toHaveBeenNthCalledWith(2, {
      provider: 'github',
      owner: 'NotaDown',
      repo: 'NotaDown',
    })
    expect(state).toMatchObject({
      status: 'available',
      version: '1.3.0',
      error: null,
      metadataSource: 'self-hosted',
      metadataUrl: 'https://updates.example.test/latest.yml',
    })
    expect(events.some((event) => event.status === 'error')).toBe(false)
  })

  it('reports the GitHub failure when the metadata source fails too', async () => {
    const { updater, service } = setup(
      {},
      { metadataBaseUrl: 'https://updates.example.test' },
    )
    updater.checkForUpdates
      .mockRejectedValueOnce(new Error('github unreachable'))
      .mockRejectedValueOnce(new Error('metadata unreachable'))

    const state = await service.check()

    expect(state).toMatchObject({ status: 'error', error: 'github unreachable' })
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
    expect(updater.setFeedURL).toHaveBeenLastCalledWith({
      provider: 'github',
      owner: 'NotaDown',
      repo: 'NotaDown',
    })
  })

  it('keeps GitHub as the only source when GitHub answers', async () => {
    const { updater, service } = setup(
      {},
      { metadataBaseUrl: 'https://updates.example.test' },
    )
    updater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.3.0' } })

    const state = await service.check()

    expect(state).toMatchObject({
      status: 'available',
      version: '1.3.0',
      metadataSource: 'github',
      metadataUrl: null,
    })
    expect(updater.setFeedURL).not.toHaveBeenCalled()
  })

  it('does not start a second check while one is running', async () => {
    const { updater, service } = setup()
    let release = () => {}
    const pending = new Promise<null>((resolve) => {
      release = () => resolve(null)
    })
    updater.checkForUpdates.mockImplementation(() => pending)

    const first = service.check()
    const second = service.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)

    release()
    await Promise.all([first, second])
  })

  it('tracks download progress through to the downloaded state', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    updater.downloadUpdate.mockImplementation(async () => {
      updater.emit('download-progress', {
        percent: 42,
        transferred: 420,
        total: 1000,
        bytesPerSecond: 100,
      })
    })

    await service.download()
    expect(service.getState()).toMatchObject({
      status: 'downloading',
      progress: 0.42,
      transferred: 420,
      total: 1000,
      bytesPerSecond: 100,
    })

    updater.emit('update-downloaded', { version: '1.3.0' })
    expect(service.getState()).toMatchObject({ status: 'downloaded', progress: 1 })
  })

  it('refuses to download without an available update', async () => {
    const { service } = setup()
    await expect(service.download()).rejects.toThrow('NO_UPDATE_AVAILABLE')
  })

  it('reports download failures and rethrows', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    updater.downloadUpdate.mockRejectedValue(new Error('disk full'))

    await expect(service.download()).rejects.toThrow('disk full')
    expect(service.getState()).toMatchObject({ status: 'error', error: 'disk full' })
  })

  it('uses GitHub directly when the download succeeds', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    provideUpdateFiles(updater)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await service.download('auto')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
    expect(updater.disableDifferentialDownload).toBe(false)
    expect(service.getState().downloadUrl).toBe(
      'https://github.com/NotaDown/NotaDown/releases/download/v1.3.0/NotaDown.1.3.0-x64.exe',
    )
  })

  it('falls back to a mirror when the GitHub download fails', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    provideUpdateFiles(updater)

    let mirroredUrl = ''
    updater.downloadUpdate
      .mockRejectedValueOnce(new Error('github unreachable'))
      .mockImplementation(async () => {
        const update = updater.updateInfoAndProvider!
        mirroredUrl = update.provider.resolveFiles(update.info)[0].url.href
      })

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://gh-proxy.com/')) {
        return new Response(null, {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-0/1000',
          },
        })
      }
      if (url.startsWith('https://ghproxy.net/')) throw new Error('blocked')
      return new Response('forbidden', { status: 403 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await service.download('auto')

    expect(mirroredUrl).toBe(
      'https://gh-proxy.com/https://github.com/NotaDown/NotaDown/releases/download/v1.3.0/NotaDown.1.3.0-x64.exe',
    )
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(updater.disableDifferentialDownload).toBe(false)
    expect(service.getState()).toMatchObject({
      status: 'downloading',
      error: null,
      downloadUrl:
        'https://gh-proxy.com/https://github.com/NotaDown/NotaDown/releases/download/v1.3.0/NotaDown.1.3.0-x64.exe',
    })
  })

  it('tries another mirror when the first mirror download fails', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    provideUpdateFiles(updater)

    const hosts: string[] = []
    updater.downloadUpdate.mockImplementation(async () => {
      const update = updater.updateInfoAndProvider!
      const url = update.provider.resolveFiles(update.info)[0].url
      hosts.push(url.host)
      if (hosts.length < 3) throw new Error(`attempt ${hosts.length}`)
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input)
        if (
          url.startsWith('https://gh-proxy.com/') ||
          url.startsWith('https://ghproxy.net/')
        ) {
          return new Response(null, {
            status: 206,
            headers: {
              'content-type': 'application/octet-stream',
              'content-range': 'bytes 0-0/1000',
            },
          })
        }
        return new Response('forbidden', { status: 403 })
      }),
    )

    await service.download('auto')

    expect(hosts).toEqual(['github.com', 'gh-proxy.com', 'ghproxy.net'])
  })

  it('keeps GitHub-only downloads away from mirrors', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    provideUpdateFiles(updater)
    updater.downloadUpdate.mockRejectedValue(new Error('offline'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(service.download('github')).rejects.toThrow('offline')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(service.getState()).toMatchObject({ status: 'error', error: 'offline' })
  })

  it('reports the GitHub failure when every mirror is unreachable', async () => {
    const { updater, service } = setup()
    updater.emit('update-available', { version: '1.3.0' })
    provideUpdateFiles(updater)
    updater.downloadUpdate.mockRejectedValue(new Error('github unreachable'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('blocked', { status: 403 })),
    )

    await expect(service.download('auto')).rejects.toThrow('github unreachable')

    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
    expect(service.getState()).toMatchObject({
      status: 'error',
      error: 'github unreachable',
    })
  })

  it('only installs a downloaded update', () => {
    const { updater, service } = setup()
    expect(() => service.install()).toThrow('NO_UPDATE_DOWNLOADED')

    updater.emit('update-available', { version: '1.3.0' })
    updater.emit('update-downloaded', { version: '1.3.0' })
    service.install()

    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
