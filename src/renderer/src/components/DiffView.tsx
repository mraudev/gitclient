import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n'
import { parseDiff, type DiffInfo } from '../lib/diff'

const MAX_LINES = 5000

function infoText(info: DiffInfo, param: string): string {
  switch (info) {
    case 'renamedFrom':
      return t.diff.renamedFrom(param)
    case 'modeChanged':
      return t.diff.modeChanged(param)
    case 'binary':
      return t.diff.binary
    case 'tooLarge':
      return t.diff.tooLarge
    case 'noNewline':
      return t.diff.noNewline
  }
}

interface Props {
  diff: string | null
  title?: string
  emptyText?: string
  /** Optionale Buttons in jedem Hunk-Header (z. B. "Hunk stagen") */
  hunkActions?: HunkAction[]
  /** Optionale Aktionen für ausgewählte +/- Zeilen; aktiviert die Zeilenauswahl */
  lineActions?: LineAction[]
}

export interface HunkAction {
  label: string
  danger?: boolean
  onClick(hunkIndex: number): void
}

export interface LineAction {
  label: string
  danger?: boolean
  /** Erhält die Zeilenindizes in der Roh-Ausgabe (siehe DiffLine.raw) */
  onClick(rawLines: ReadonlySet<number>): void
}

export function DiffView({ diff, title, emptyText = t.changes.selectFile, hunkActions, lineActions }: Props) {
  const lines = useMemo(() => (diff === null ? [] : parseDiff(diff)), [diff])
  const selectable = useMemo(() => (lineActions ? lines.flatMap((l) => (l.raw === undefined ? [] : [l.raw])) : []), [lines, lineActions])
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const anchor = useRef<number | null>(null)
  const dragging = useRef(false)

  // Neuer Diff-Inhalt (andere Datei oder nach einer Aktion): Auswahl verwerfen
  useEffect(() => {
    setSelected(new Set())
    anchor.current = null
  }, [diff])

  useEffect(() => {
    const stop = () => (dragging.current = false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const range = (a: number, b: number) => new Set(selectable.filter((r) => r >= Math.min(a, b) && r <= Math.max(a, b)))

  const onLineMouseDown = (e: React.MouseEvent, raw: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (e.shiftKey && anchor.current !== null) {
      setSelected(range(anchor.current, raw))
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected)
      if (next.has(raw)) next.delete(raw)
      else next.add(raw)
      setSelected(next)
      anchor.current = raw
    } else {
      // Klick auf die einzige ausgewählte Zeile hebt die Auswahl auf
      setSelected(selected.size === 1 && selected.has(raw) ? new Set() : new Set([raw]))
      anchor.current = raw
      dragging.current = true
    }
  }

  const onLineMouseEnter = (raw: number) => {
    if (dragging.current && anchor.current !== null) setSelected(range(anchor.current, raw))
  }

  if (diff === null) return <div className="placeholder">{emptyText}</div>

  const hasSelectable = selectable.length > 0

  return (
    <div className="diff" tabIndex={-1} onKeyDown={(e) => e.key === 'Escape' && setSelected(new Set())}>
      {(title || hasSelectable) && (
        <div className="diff-title">
          <span className="diff-path">{title}</span>
          {lineActions && selected.size > 0 ? (
            <span className="line-actions">
              <span className="dim">{t.diff.linesSelected(t.changes.lines(selected.size))}</span>
              {lineActions.map((a) => (
                <button key={a.label} className={`small ${a.danger ? 'danger' : ''}`} onClick={() => a.onClick(selected)}>
                  {a.label}
                </button>
              ))}
            </span>
          ) : (
            hasSelectable && <span className="dim hint">{t.diff.selectHint}</span>
          )}
        </div>
      )}
      <div className="diff-body">
        {lines.length === 0 && <div className="placeholder">{t.diff.noTextChanges}</div>}
        {lines.slice(0, MAX_LINES).map((l, i) => {
          const canSelect = lineActions && l.raw !== undefined
          return (
            <div
              key={i}
              className={`diff-line ${l.kind} ${canSelect ? 'selectable' : ''} ${canSelect && selected.has(l.raw!) ? 'selected' : ''}`}
              onMouseDown={canSelect ? (e) => onLineMouseDown(e, l.raw!) : undefined}
              onMouseEnter={canSelect ? () => onLineMouseEnter(l.raw!) : undefined}
            >
              <span className="ln">{l.oldNo ?? ''}</span>
              <span className="ln">{l.newNo ?? ''}</span>
              <span className="code">{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}{l.info ? infoText(l.info, l.text) : l.text}</span>
              {hunkActions && l.hunkIndex !== undefined && (
                <span className="hunk-actions">
                  {hunkActions.map((a) => (
                    <button key={a.label} className={`small ${a.danger ? 'danger' : ''}`} onClick={() => a.onClick(l.hunkIndex!)}>
                      {a.label}
                    </button>
                  ))}
                </span>
              )}
            </div>
          )
        })}
        {lines.length > MAX_LINES && <div className="placeholder">{t.diff.moreLinesHidden(lines.length - MAX_LINES)}</div>}
      </div>
    </div>
  )
}
