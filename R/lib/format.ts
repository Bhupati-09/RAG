const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

import type { UiLanguage } from './types'

const localeByLanguage: Record<UiLanguage, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr-FR',
  de: 'de-DE',
  'pt-BR': 'pt-BR',
  ja: 'ja-JP',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
}

export function formatBytes(bytes: number, language: UiLanguage = 'en') {
  const numberFormatter = new Intl.NumberFormat(localeByLanguage[language], { maximumFractionDigits: 1 })
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)} KB`
  return `${numberFormatter.format(bytes / (1024 * 1024))} MB`
}

export function formatTime(ts: number, language: UiLanguage = 'en') {
  const timeFormatter = new Intl.DateTimeFormat(localeByLanguage[language], {
    hour: 'numeric',
    minute: '2-digit',
  })
  return timeFormatter.format(ts)
}

export const createId = () => crypto.randomUUID()
