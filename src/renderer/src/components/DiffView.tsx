import { useMemo } from 'react'
import { parseDiff } from '../lib/diff'

const MAX_LINES = 5000

interface Props {
  diff: string | null
  title?: string
  emptyText?: string
}

export function DiffView({ diff, title, emptyText = 'Datei auswählen, um die Änderungen zu sehen' }: Props) {
  const lines = useMemo(() => (diff === null ? [] : parseDiff(diff)), [diff])

  if (diff === null) return <div className="placeholder">{emptyText}</div>

  return (
    <div className="diff">
      {title && <div className="diff-title">{title}</div>}
      <div className="diff-body">
        {lines.length === 0 && <div className="placeholder">Keine Textänderungen</div>}
        {lines.slice(0, MAX_LINES).map((l, i) => (
          <div key={i} className={`diff-line ${l.kind}`}>
            <span className="ln">{l.oldNo ?? ''}</span>
            <span className="ln">{l.newNo ?? ''}</span>
            <span className="code">{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}{l.text}</span>
          </div>
        ))}
        {lines.length > MAX_LINES && (
          <div className="placeholder">… {lines.length - MAX_LINES} weitere Zeilen ausgeblendet</div>
        )}
      </div>
    </div>
  )
}
