import { dateLocale } from '../i18n'

const dateFormats = new Map<string, Intl.DateTimeFormat>()

export function formatDate(ms: number): string {
  const locale = dateLocale()
  let fmt = dateFormats.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
    dateFormats.set(locale, fmt)
  }
  return fmt.format(new Date(ms))
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

export function splitPath(p: string): { name: string; dir: string } {
  const i = p.lastIndexOf('/')
  return i === -1 ? { name: p, dir: '' } : { name: p.slice(i + 1), dir: p.slice(0, i) }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
