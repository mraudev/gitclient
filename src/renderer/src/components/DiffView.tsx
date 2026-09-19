import { useMemo } from 'react'
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
}

export interface HunkAction {
  label: string
  danger?: boolean
  onClick(hunkIndex: number): void
}

export function DiffView({ diff, title, emptyText = t.changes.selectFile, hunkActions }: Props) {
  const lines = useMemo(() => (diff === null ? [] : parseDiff(diff)), [diff])

  if (diff === null) return <div className="placeholder">{emptyText}</div>

  return (
    <div className="diff">
      {title && <div className="diff-title">{title}</div>}
      <div className="diff-body">
        {lines.length === 0 && <div className="placeholder">{t.diff.noTextChanges}</div>}
        {lines.slice(0, MAX_LINES).map((l, i) => (
          <div key={i} className={`diff-line ${l.kind}`}>
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
        ))}
        {lines.length > MAX_LINES && <div className="placeholder">{t.diff.moreLinesHidden(lines.length - MAX_LINES)}</div>}
      </div>
    </div>
  )
}
