import type { DesktopBridge } from '@notadown/shared'
import { DesktopPlatform } from './desktop/desktop-platform'
import type { Platform } from './types'
import { WebPlatform } from './web/web-platform'

export type { AssetTarget, DocumentWriteResult, Platform } from './types'
export { DesktopPlatform } from './desktop/desktop-platform'
export { WebPlatform } from './web/web-platform'

export interface CreatePlatformOptions {
  version?: string
  bridge?: DesktopBridge | null
}

export function createPlatform(options: CreatePlatformOptions = {}): Platform {
  const version = options.version ?? '0.0.0'
  const bridge = options.bridge ?? (typeof window === 'undefined' ? null : window.notadown)
  if (bridge) return new DesktopPlatform(bridge, version)
  return new WebPlatform(version)
}
