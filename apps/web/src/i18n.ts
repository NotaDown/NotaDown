import { createAppI18n, detectLocale } from '@notadown/i18n'

export const i18n = createAppI18n(detectLocale('system'))
