import type { FileStatus } from '../../../shared/types'

const dateFmt = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms))
}

export function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

export const statusLabel: Record<FileStatus, string> = {
  A: 'Hinzugefügt',
  M: 'Geändert',
  D: 'Gelöscht',
  R: 'Umbenannt',
  C: 'Kopiert',
  T: 'Typ geändert',
  U: 'Konflikt',
  '?': 'Neu (untracked)'
}

export function splitPath(p: string): { name: string; dir: string } {
  const i = p.lastIndexOf('/')
  return i === -1 ? { name: p, dir: '' } : { name: p.slice(i + 1), dir: p.slice(0, i) }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
