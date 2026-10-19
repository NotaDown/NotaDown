import { i18n } from './i18n'

export function errorCode(error: unknown): string {
  if (error instanceof Error) {
    const ipcError = /Error: ([A-Z0-9_]+)$/.exec(error.message)
    return ipcError ? ipcError[1] : error.message
  }
  if (typeof error === 'string') return error
  return ''
}

export function describeError(error: unknown): string {
  const code = errorCode(error)
  const t = i18n.global.t
  switch (code) {
    case 'NOT_FOUND':
      return t('errors.notFound')
    case 'PERMISSION_DENIED':
      return t('errors.permission')
    case 'ALREADY_EXISTS':
      return t('tree.nameExists')
    case 'INVALID_NAME':
    case 'INVALID_PATH':
      return t('errors.invalidName')
    case 'TOO_LARGE':
      return t('errors.tooLarge')
    case 'UNSUPPORTED':
    case 'NO_WORKSPACE':
      return t('errors.unsupported')
    case 'FILE_SYSTEM_ACCESS_UNSUPPORTED':
      return t('web.folderUnavailable')
    default:
      return code && !/^[A-Z0-9_]+$/.test(code) ? code : t('errors.generic')
  }
}
