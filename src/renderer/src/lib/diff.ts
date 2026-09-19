import { PREVIEW_TOO_LARGE } from '../../../shared/types'

export type DiffLineKind = 'context' | 'add' | 'del' | 'hunk' | 'file' | 'info'

/** Art einer Info-Zeile; übersetzt wird erst in der Anzeige, damit der Parser sprachunabhängig bleibt */
export type DiffInfo = 'renamedFrom' | 'modeChanged' | 'binary' | 'tooLarge' | 'noNewline'

export interface DiffLine {
  kind: DiffLineKind
  /** Bei Info-Zeilen der Parameter (z. B. alter Pfad), sonst der Zeileninhalt */
  text: string
  info?: DiffInfo
  oldNo?: number
  newNo?: number
  /** Laufende Nummer des Hunks (nur bei normalen "@@"-Headern), passend zu extractHunkPatch */
  hunkIndex?: number
}

/** Zerlegt eine Unified-Diff-Ausgabe von git in darstellbare Zeilen mit Zeilennummern. */
export function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  let inHunk = false
  let combined = false // "diff --cc" bei Merge-Konflikten: zwei Präfixspalten, keine Zeilennummern
  let hunkIndex = 0
  const multiFile = (raw.match(/^diff --git /gm) ?? []).length > 1

  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --cc ')) {
      inHunk = false
      continue
    }
    if (line.startsWith('diff --git ')) {
      inHunk = combined = false
      if (multiFile) result.push({ kind: 'file', text: line.replace(/^diff --git a\/(.*) b\/.*$/, '$1') })
      continue
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      inHunk = true
      result.push({ kind: 'hunk', text: line, hunkIndex: hunkIndex++ })
      continue
    }
    if (line.startsWith('@@@ ')) {
      inHunk = combined = true
      result.push({ kind: 'hunk', text: line })
      continue
    }
    if (inHunk && combined) {
      const prefix = line.slice(0, 2)
      const kind = prefix.includes('+') ? 'add' : prefix.includes('-') ? 'del' : 'context'
      if (line) result.push({ kind, text: line.slice(2) })
      continue
    }
    if (!inHunk) {
      if (line.startsWith('rename from ')) result.push({ kind: 'info', info: 'renamedFrom', text: line.slice(12) })
      else if (line.startsWith('old mode ')) result.push({ kind: 'info', info: 'modeChanged', text: line.slice(9) })
      else if (/^Binary files .* differ$/.test(line)) result.push({ kind: 'info', info: 'binary', text: '' })
      else if (line === PREVIEW_TOO_LARGE) result.push({ kind: 'info', info: 'tooLarge', text: '' })
      continue
    }
    if (line.startsWith('+')) result.push({ kind: 'add', text: line.slice(1), newNo: newNo++ })
    else if (line.startsWith('-')) result.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++ })
    else if (line.startsWith(' ')) result.push({ kind: 'context', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
    else if (line.startsWith('\\')) result.push({ kind: 'info', info: 'noNewline', text: line.slice(2) })
  }
  return result
}

/**
 * Baut aus einer git-Diff-Ausgabe einen eigenständigen Patch, der nur den Hunk Nr. `index` enthält
 * (Datei-Header + Hunk, Zeilen unverändert inkl. evtl. "\r"), geeignet für `git apply`.
 */
export function extractHunkPatch(raw: string, index: number): string | null {
  const lines = raw.split('\n')
  let header: string[] = []
  let inHeader = false
  let count = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('diff --git ')) {
      header = [line]
      inHeader = true
    } else if (line.startsWith('@@ ')) {
      inHeader = false
      if (++count !== index) continue
      const body = [line]
      for (let j = i + 1; j < lines.length && /^[ +\-\\]/.test(lines[j]); j++) body.push(lines[j])
      return [...header, ...body].join('\n') + '\n'
    } else if (inHeader) {
      header.push(line)
    }
  }
  return null
}
