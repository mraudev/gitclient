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
  /** Zeilenindex in der Roh-Ausgabe (nur bei +/- Zeilen normaler Hunks), passend zu buildLinesPatch */
  raw?: number
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

/** Zerlegt eine Unified-Diff-Ausgabe von git in darstellbare Zeilen mit Zeilennummern. */
export function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  let inHunk = false
  let combined = false // "diff --cc" bei Merge-Konflikten: zwei Präfixspalten, keine Zeilennummern
  let hunkIndex = 0
  const multiFile = (raw.match(/^diff --git /gm) ?? []).length > 1
  const lines = raw.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('diff --cc ')) {
      inHunk = false
      continue
    }
    if (line.startsWith('diff --git ')) {
      inHunk = combined = false
      if (multiFile) result.push({ kind: 'file', text: line.replace(/^diff --git a\/(.*) b\/.*$/, '$1') })
      continue
    }
    const hunk = HUNK_HEADER.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[3])
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
    if (line.startsWith('+')) result.push({ kind: 'add', text: line.slice(1), newNo: newNo++, raw: i })
    else if (line.startsWith('-')) result.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++, raw: i })
    else if (line.startsWith(' ')) result.push({ kind: 'context', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
    else if (line.startsWith('\\')) result.push({ kind: 'info', info: 'noNewline', text: line.slice(2) })
  }
  return result
}

/**
 * Datei-Header für Teil-Patches. Rename-/Copy-Angaben fallen weg, damit das Anwenden eines Teils
 * nicht die ganze Umbenennung mit anwendet bzw. rückgängig macht. Bei `keepFileOps = false`
 * wird aus "neue Datei"/"gelöschte Datei" eine normale Änderung (für teilweise Auswahl).
 */
function patchHeader(header: string[], keepFileOps: boolean): string[] {
  const path = header.find((l) => l.startsWith('+++ b/'))?.slice(6) ?? header.find((l) => l.startsWith('--- a/'))?.slice(6)
  if (!path) return header
  return header.flatMap((l) => {
    if (/^(similarity index|dissimilarity index|rename from|rename to|copy from|copy to) /.test(l)) return []
    if (l.startsWith('diff --git ')) return [`diff --git a/${path} b/${path}`]
    if (l.startsWith('--- ')) return [keepFileOps && l === '--- /dev/null' ? l : `--- a/${path}`]
    if (l.startsWith('+++ ')) return [keepFileOps && l === '+++ /dev/null' ? l : `+++ b/${path}`]
    if (!keepFileOps && /^(new|deleted) file mode /.test(l)) return []
    return [l]
  })
}

/** Liefert Header-Zeilen und Startindex des ersten Hunks. Erwartet den Diff einer einzelnen Datei. */
function splitHeader(lines: string[]): { header: string[]; first: number } {
  let i = 0
  while (i < lines.length && !lines[i].startsWith('@@ ')) i++
  return { header: lines.slice(0, i), first: i }
}

const isHunkBody = (line: string | undefined) => line !== undefined && /^[ +\-\\]/.test(line)

interface Entry {
  line: string
  selected: boolean
  marker?: string
}

/**
 * Baut aus dem Diff einer Datei einen eigenständigen Patch, der nur den Hunk Nr. `index` enthält
 * (Zeilen unverändert inkl. evtl. "\r"), geeignet für `git apply`.
 */
export function extractHunkPatch(raw: string, index: number): string | null {
  const lines = raw.split('\n')
  const { header, first } = splitHeader(lines)
  let count = -1
  for (let i = first; i < lines.length; i++) {
    if (!lines[i].startsWith('@@ ') || ++count !== index) continue
    const body = [lines[i]]
    for (let j = i + 1; isHunkBody(lines[j]); j++) body.push(lines[j])
    return [...patchHeader(header, true), ...body].join('\n') + '\n'
  }
  return null
}

/**
 * Baut aus dem Diff einer Datei einen Patch, der nur die ausgewählten +/- Zeilen (Indizes in der
 * Roh-Ausgabe) enthält.
 * - `reverse = false`: Patch wird vorwärts angewendet (Stagen). Nicht gewählte "-" werden Kontext,
 *   nicht gewählte "+" entfallen.
 * - `reverse = true`: Patch wird mit `-R` angewendet (Unstagen/Verwerfen). Nicht gewählte "+"
 *   werden Kontext, nicht gewählte "-" entfallen.
 */
export function buildLinesPatch(raw: string, selected: ReadonlySet<number>, reverse: boolean): string | null {
  const lines = raw.split('\n')
  const { header, first } = splitHeader(lines)
  const hunks: string[] = []
  let delta = 0 // Summe (neu - alt) der bereits übernommenen Hunks
  let partial = false

  for (let i = first; i < lines.length; ) {
    const m = HUNK_HEADER.exec(lines[i++])
    if (!m) continue
    const body: string[] = []
    let oldCount = 0
    let newCount = 0
    let hasSelection = false

    // Zeile mit evtl. folgendem "\ No newline at end of file"
    const entry = (): Entry => {
      const e: Entry = { line: lines[i], selected: selected.has(i) }
      if (lines[i + 1]?.startsWith('\\')) e.marker = lines[++i]
      i++
      return e
    }
    const emit = (prefix: string, e: Entry) => {
      body.push(prefix + e.line.slice(1), ...(e.marker ? [e.marker] : []))
      if (prefix !== '+') oldCount++
      if (prefix !== '-') newCount++
    }

    while (isHunkBody(lines[i])) {
      if (lines[i][0] === ' ') {
        emit(' ', entry())
        continue
      }
      if (lines[i][0] === '\\') {
        i++ // verwaister Marker, gehört zu keiner Zeile
        continue
      }
      // Änderungsblock: git gibt erst alle "-", dann alle "+" aus
      const dels: Entry[] = []
      const adds: Entry[] = []
      while (lines[i]?.[0] === '-') dels.push(entry())
      while (lines[i]?.[0] === '+') adds.push(entry())
      // Die k-te gelöschte Zeile gehört zur k-ten hinzugefügten (Ersetzung) – paarweise ausgeben,
      // damit z. B. nur "b → b2" gestaged die Reihenfolge der übrigen Zeilen nicht vertauscht
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
        const d = dels[k]
        const a = adds[k]
        if (d?.selected || a?.selected) hasSelection = true
        if ((d && !d.selected) || (a && !a.selected)) partial = true
        if (d?.selected) emit('-', d)
        else if (d && !reverse) emit(' ', d)
        if (a?.selected) emit('+', a)
        else if (a && reverse) emit(' ', a)
      }
    }
    if (!hasSelection) continue

    // Die Seite, auf die der Patch angewendet wird, behält Positionen und Zeilenzahl des Originals;
    // bei Zeilenzahl 0 zeigt der Start laut Unified-Diff-Format auf die Zeile davor
    let oldStart: number
    let newStart: number
    if (reverse) {
      newStart = Number(m[3])
      oldStart = newStart - delta - (oldCount === 0 ? 1 : 0)
    } else {
      oldStart = Number(m[1])
      newStart = oldStart + delta - (newCount === 0 ? 1 : 0)
    }
    if (oldCount > 0 && oldStart === 0) oldStart = 1
    if (newCount > 0 && newStart === 0) newStart = 1
    delta += newCount - oldCount
    hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${m[5]}`, ...body)
  }

  if (hunks.length === 0) return null
  return [...patchHeader(header, !partial), ...hunks].join('\n') + '\n'
}
