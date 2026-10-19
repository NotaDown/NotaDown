import { createI18n } from 'vue-i18n'
import type { LocalePreference } from '@notadown/shared'
import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'

export const SUPPORTED_LOCALES = ['en-US', 'zh-CN'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_NAMES: Record<AppLocale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
}

const MESSAGES = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en-US' || value === 'zh-CN'
}

export function getSystemLocale(): AppLocale {
  const language =
    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
  return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function detectLocale(preference: LocalePreference): AppLocale {
  if (isAppLocale(preference)) return preference
  return getSystemLocale()
}

export function createAppI18n(locale: AppLocale) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages: MESSAGES as unknown as Record<string, typeof enUS>,
  })
}

export type AppI18n = ReturnType<typeof createAppI18n>

export function formatDateTime(timestamp: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

export function formatDate(timestamp: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(timestamp))
}

export function formatTime(timestamp: number, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(timestamp))
}

export function formatRelativeTime(
  timestamp: number,
  locale: AppLocale,
  now = Date.now(),
): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffSeconds = Math.round((timestamp - now) / 1000)
  const absolute = Math.abs(diffSeconds)

  if (absolute < 45) return formatter.format(diffSeconds, 'second')
  if (absolute < 2700) return formatter.format(Math.round(diffSeconds / 60), 'minute')
  if (absolute < 79200) return formatter.format(Math.round(diffSeconds / 3600), 'hour')
  if (absolute < 2592000) return formatter.format(Math.round(diffSeconds / 86400), 'day')
  if (absolute < 31536000) return formatter.format(Math.round(diffSeconds / 2592000), 'month')
  return formatter.format(Math.round(diffSeconds / 31536000), 'year')
}

export function formatNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale).format(value)
}

export { enUS, zhCN }
