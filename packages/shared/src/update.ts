export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'
  | 'unsupported'

export type UpdateUnsupportedReason = 'development' | 'platform'

export interface UpdateSnapshot {
  status: UpdateStatus
  currentVersion: string
  version: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progress: number | null
  transferred: number | null
  total: number | null
  bytesPerSecond: number | null
  error: string | null
  reason: UpdateUnsupportedReason | null
  manualDownloadUrl: string
}

export const UPDATE_RELEASES_URL = 'https://github.com/NotaDown/NotaDown/releases'
