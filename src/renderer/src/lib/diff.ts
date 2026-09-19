export type DiffLineKind = 'context' | 'add' | 'del' | 'hunk' | 'file' | 'info'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  oldNo?: number
  newNo?: number
}

/** Zerlegt eine Unified-Diff-Ausgabe von git in darstellbare Zeilen mit Zeilennummern. */
export function parseDiff(raw: string): DiffLine[] {
  const result: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  let inHunk = false
  let combined = false // "diff --cc" bei Merge-Konflikten: zwei Präfixspalten, keine Zeilennummern
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
      result.push({ kind: 'hunk', text: line })
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
      if (line.startsWith('rename from ')) result.push({ kind: 'info', text: `Umbenannt von ${line.slice(12)}` })
      else if (line.startsWith('old mode ')) result.push({ kind: 'info', text: `Dateimodus geändert: ${line.slice(9)}` })
      else if (/^Binary files .* differ$/.test(line)) result.push({ kind: 'info', text: 'Binärdatei – keine Textvorschau' })
      else if (line === 'Datei zu groß für die Vorschau') result.push({ kind: 'info', text: line })
      continue
    }
    if (line.startsWith('+')) result.push({ kind: 'add', text: line.slice(1), newNo: newNo++ })
    else if (line.startsWith('-')) result.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++ })
    else if (line.startsWith(' ')) result.push({ kind: 'context', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ })
    else if (line.startsWith('\\')) result.push({ kind: 'info', text: line.slice(2) })
  }
  return result
}
