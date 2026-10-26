import { describe, expect, it, vi } from 'vitest'
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
  checkForUpdates = vi.fn<() => Promise<UpdateCheckResultLike | null>>(async () => null)
  downloadUpdate = vi.fn<() => Promise<unknown>>(async () => undefined)
  quitAndInstall = vi.fn<(isSilent?: boolean, isForceRunAfter?: boolean) => void>()

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

function setup(overrides: Partial<UpdateRuntime> = {}) {
  const updater = new FakeUpdater()
  const events: UpdateSnapshot[] = []
  const service = createUpdateService(updater, runtime(overrides), (snapshot) => {
    events.push(snapshot)
  })
  return { updater, service, events }
}

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
    })
    expect(events.map((event) => event.status)).toEqual(['checking', 'available'])
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

  it('only installs a downloaded update', () => {
    const { updater, service } = setup()
    expect(() => service.install()).toThrow('NO_UPDATE_DOWNLOADED')

    updater.emit('update-available', { version: '1.3.0' })
    updater.emit('update-downloaded', { version: '1.3.0' })
    service.install()

    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
