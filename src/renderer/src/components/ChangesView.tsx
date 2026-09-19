import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import type { FileChange, StatusResult } from '../../../shared/types'
import { app, git } from '../api'
import { discardChanges } from '../actions'
import { notifyError } from '../dialogs'
import { extractHunkPatch } from '../lib/diff'
import { useRepo } from '../repoContext'
import { DiffView } from './DiffView'
import { FileList } from './FileList'
import { Split } from './Split'

interface Selection {
  path: string
  staged: boolean
}

export function ChangesView({ status }: { status: StatusResult }) {
  const { repo, run } = useRepo()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)

  const findFile = (sel: Selection | null) => (sel ? (sel.staged ? status.staged : status.unstaged).find((f) => f.path === sel.path) : undefined)

  // Nach Stagen/Unstagen folgt die Auswahl der Datei in die andere Liste
  useEffect(() => {
    if (!selection || findFile(selection)) return
    const other = { path: selection.path, staged: !selection.staged }
    setSelection(findFile(other) ? other : null)
  }, [status])

  const selectedFile = findFile(selection)

  useEffect(() => {
    let stale = false
    if (!selectedFile || !selection) {
      setDiff(null)
      return
    }
    git
      .fileDiff(repo, selectedFile, selection.staged)
      .then((d) => !stale && setDiff(d))
      .catch(notifyError)
    return () => {
      stale = true
    }
  }, [repo, status, selection?.path, selection?.staged])

  const stage = (f: FileChange) => run('Stagen', () => git.stage(repo, [f.path]))
  const unstage = (f: FileChange) => run('Unstagen', () => git.unstage(repo, f.oldPath ? [f.oldPath, f.path] : [f.path]))

  // Untracked Dateien und Konflikte haben keine anwendbaren Hunks
  const hunkAction =
    selectedFile && selection && diff && selectedFile.status !== '?' && selectedFile.status !== 'U'
      ? {
          label: selection.staged ? 'Hunk unstagen' : 'Hunk stagen',
          onClick: (index: number) => {
            const patch = extractHunkPatch(diff, index)
            if (!patch) return notifyError('Hunk nicht gefunden – bitte neu laden.')
            void run(selection.staged ? 'Hunk unstagen' : 'Hunk stagen', () => git.applyToIndex(repo, patch, selection.staged))
          }
        }
      : undefined

  const unstagedMenu = async (f: FileChange) => {
    const choice = await app.contextMenu([
      { id: 'stage', label: f.status === 'U' ? 'Als gelöst markieren (stagen)' : 'Stagen' },
      { id: 'discard', label: 'Änderungen verwerfen…', enabled: f.status !== 'U' },
      { type: 'separator' },
      { id: 'show', label: 'Im Explorer anzeigen', enabled: f.status !== 'D' }
    ])
    if (choice === 'stage') void stage(f)
    if (choice === 'discard') void run('Verwerfen', () => discardChanges(repo, [f]))
    if (choice === 'show') void app.showInFolder(`${repo}/${f.path}`)
  }

  const stagedMenu = async (f: FileChange) => {
    const choice = await app.contextMenu([
      { id: 'unstage', label: 'Unstagen' },
      { type: 'separator' },
      { id: 'show', label: 'Im Explorer anzeigen', enabled: f.status !== 'D' }
    ])
    if (choice === 'unstage') void unstage(f)
    if (choice === 'show') void app.showInFolder(`${repo}/${f.path}`)
  }

  const toggleAmend = async (checked: boolean) => {
    setAmend(checked)
    if (checked && !message.trim()) {
      try {
        setMessage(await git.lastCommitMessage(repo))
      } catch (e) {
        notifyError(e)
      }
    }
  }

  const canCommit = message.trim().length > 0 && (status.staged.length > 0 || amend)
  const commit = () => {
    if (!canCommit) return
    void run(amend ? 'Amend' : 'Commit', async () => {
      await git.commit(repo, message, amend)
      setMessage('')
      setAmend(false)
    })
  }

  const conflicts = status.unstaged.filter((f) => f.status === 'U').length

  return (
    <Split direction="row" initial={400} storageKey="changes" min={260}>
      <div className="changes-side">
        <Split direction="column" initial={300} storageKey="changes-lists" min={80}>
          <div className="file-section">
            <div className="section-title">
              <span>Nicht gestagt ({status.unstaged.length})</span>
              {conflicts > 0 && <span className="conflict-hint">{conflicts} Konflikt(e)</span>}
              <button className="small" disabled={!status.unstaged.length} onClick={() => run('Alle stagen', () => git.stageAll(repo))}>
                Alle stagen
              </button>
            </div>
            <FileList
              files={status.unstaged}
              selectedPath={selection && !selection.staged ? selection.path : null}
              onSelect={(f) => setSelection({ path: f.path, staged: false })}
              onDoubleClick={stage}
              onContextMenu={unstagedMenu}
              action={{ icon: <ArrowDownToLine size={14} />, title: 'Stagen', onClick: stage }}
            />
          </div>
          <div className="file-section">
            <div className="section-title">
              <span>Gestagt ({status.staged.length})</span>
              <button className="small" disabled={!status.staged.length} onClick={() => run('Alle unstagen', () => git.unstageAll(repo))}>
                Alle unstagen
              </button>
            </div>
            <FileList
              files={status.staged}
              selectedPath={selection?.staged ? selection.path : null}
              onSelect={(f) => setSelection({ path: f.path, staged: true })}
              onDoubleClick={unstage}
              onContextMenu={stagedMenu}
              action={{ icon: <ArrowUpFromLine size={14} />, title: 'Unstagen', onClick: unstage }}
            />
          </div>
        </Split>
        <div className="commit-box">
          <textarea
            value={message}
            placeholder="Commit-Nachricht (Strg+Enter zum Committen)"
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) commit()
            }}
          />
          <div className="commit-actions">
            <label className="checkbox">
              <input type="checkbox" checked={amend} onChange={(e) => toggleAmend(e.target.checked)} />
              Letzten Commit ändern (amend)
            </label>
            <button className="primary" disabled={!canCommit} onClick={commit}>
              {amend ? 'Amend' : `Commit${status.staged.length ? ` (${status.staged.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
      <DiffView
        diff={selectedFile ? diff : null}
        title={selectedFile ? `${selectedFile.path}${selection?.staged ? ' (gestagt)' : ''}` : undefined}
        hunkAction={hunkAction}
        emptyText={status.staged.length + status.unstaged.length ? 'Datei auswählen, um die Änderungen zu sehen' : 'Keine lokalen Änderungen'}
      />
    </Split>
  )
}
