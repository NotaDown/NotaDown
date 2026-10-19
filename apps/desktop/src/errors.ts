const ERROR_CODES: Record<string, string> = {
  ENOENT: 'NOT_FOUND',
  ENOTDIR: 'INVALID_PATH',
  EISDIR: 'INVALID_PATH',
  EINVAL: 'INVALID_PATH',
  EEXIST: 'ALREADY_EXISTS',
  ENOTEMPTY: 'ALREADY_EXISTS',
  EACCES: 'PERMISSION_DENIED',
  EPERM: 'PERMISSION_DENIED',
  ENAMETOOLONG: 'INVALID_NAME',
}

export function normalizeError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('UNKNOWN')
  const code = (error as NodeJS.ErrnoException).code
  if (code && ERROR_CODES[code]) return new Error(ERROR_CODES[code])
  return error
}
