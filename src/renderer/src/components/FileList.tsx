import type { ReactNode } from 'react'
import type { FileChange } from '../../../shared/types'
import { fileIconUrl } from '../lib/fileIcons'
import { t } from '../i18n'
import { splitPath } from '../lib/format'

interface Props {
  files: FileChange[]
  selectedPath?: string | null
  onSelect(file: FileChange): void
  onDoubleClick?(file: FileChange): void
  onContextMenu?(file: FileChange): void
  /** Optionaler Hover-Button je Zeile (z. B. Stagen) */
  action?: { icon: ReactNode; title: string; onClick(file: FileChange): void }
}

export function FileList({ files, selectedPath, onSelect, onDoubleClick, onContextMenu, action }: Props) {
  return (
    <div className="file-list">
      {files.map((f) => {
        const { name, dir } = splitPath(f.path)
        return (
          <div
            key={f.path}
            className={`file-row ${f.path === selectedPath ? 'selected' : ''}`}
            title={f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
            onClick={() => onSelect(f)}
            onDoubleClick={() => onDoubleClick?.(f)}
            onContextMenu={(e) => {
              e.preventDefault()
              onSelect(f)
              onContextMenu?.(f)
            }}
          >
            <span className={`status-badge s-${f.status === '?' ? 'N' : f.status}`} title={t.status[f.status]}>
              {f.status === '?' ? '+' : f.status}
            </span>
            <img className="file-icon" src={fileIconUrl(f.path)} alt="" draggable={false} />
            <span className="file-name">{name}</span>
            <span className="file-dir">{dir}</span>
            {action && (
              <button
                className="icon row-action"
                title={action.title}
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick(f)
                }}
              >
                {action.icon}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
