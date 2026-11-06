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

export type UpdateDownloadSource = 'auto' | 'github' | 'mirror'

export type UpdateMetadataSource = 'github' | 'self-hosted'

export interface UpdateSnapshot {
  status: UpdateStatus
  currentVersion: string
  version: string | null
  stableVersion: string | null
  prereleaseVersion: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progress: number | null
  transferred: number | null
  total: number | null
  bytesPerSecond: number | null
  error: string | null
  reason: UpdateUnsupportedReason | null
  manualDownloadUrl: string
  metadataSource: UpdateMetadataSource | null
  metadataUrl: string | null
  downloadUrl: string | null
}
