import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import type { FileChange, StatusResult } from '../../../shared/types'
import { app, git } from '../api'
import { discardChanges, discardPart } from '../actions'
import { notifyError } from '../dialogs'
import { t } from '../i18n'
import { buildLinesPatch, extractHunkPatch } from '../lib/diff'
import { useRepo } from '../repoContext'
import { DiffView, type HunkAction, type LineAction } from './DiffView'
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

  const stage = (f: FileChange) => run(t.busy.stage, () => git.stage(repo, [f.path]))
  const unstage = (f: FileChange) => run(t.busy.unstage, () => git.unstage(repo, f.oldPath ? [f.oldPath, f.path] : [f.path]))

  // Teil-Patches aus dem angezeigten Diff; untracked Dateien und Konflikte haben keine anwendbaren Hunks
  const withPatch = (label: string, patch: string | null, fn: (patch: string) => Promise<unknown>) => {
    if (!patch) return notifyError(t.changes.changeNotFound)
    void run(label, () => fn(patch))
  }

  let hunkActions: HunkAction[] | undefined
  let lineActions: LineAction[] | undefined
  if (selectedFile && selection && diff && selectedFile.status !== '?' && selectedFile.status !== 'U') {
    const path = selectedFile.path
    const hunk = (i: number) => extractHunkPatch(diff, i)
    const linesPatch = (sel: ReadonlySet<number>, reverse: boolean) => buildLinesPatch(diff, sel, reverse)
    if (selection.staged) {
      hunkActions = [{ label: t.buttons.unstageHunk, onClick: (i) => withPatch(t.busy.unstageHunk, hunk(i), (p) => git.applyToIndex(repo, p, true)) }]
      lineActions = [{ label: t.buttons.unstageLines, onClick: (s) => withPatch(t.busy.unstageLines, linesPatch(s, true), (p) => git.applyToIndex(repo, p, true)) }]
    } else {
      hunkActions = [
        { label: t.common.discard, danger: true, onClick: (i) => withPatch(t.busy.discardHunk, hunk(i), (p) => discardPart(repo, path, p, t.changes.thisHunk)) },
        { label: t.buttons.stageHunk, onClick: (i) => withPatch(t.busy.stageHunk, hunk(i), (p) => git.applyToIndex(repo, p, false)) }
      ]
      lineActions = [
        { label: t.common.discard, danger: true, onClick: (s) => withPatch(t.busy.discardLines, linesPatch(s, true), (p) => discardPart(repo, path, p, t.changes.lines(s.size))) },
        { label: t.buttons.stageLines, onClick: (s) => withPatch(t.busy.stageLines, linesPatch(s, false), (p) => git.applyToIndex(repo, p, false)) }
      ]
    }
  }

  const unstagedMenu = async (f: FileChange) => {
    const choice = await app.contextMenu([
      { id: 'stage', label: f.status === 'U' ? t.changes.markResolved : t.buttons.stage },
      { id: 'discard', label: t.changes.discardChangesEllipsis, enabled: f.status !== 'U' },
      { type: 'separator' },
      { id: 'show', label: t.common.showInExplorer, enabled: f.status !== 'D' }
    ])
    if (choice === 'stage') void stage(f)
    if (choice === 'discard') void run(t.busy.discard, () => discardChanges(repo, [f]))
    if (choice === 'show') void app.showInFolder(`${repo}/${f.path}`)
  }

  const stagedMenu = async (f: FileChange) => {
    const choice = await app.contextMenu([
      { id: 'unstage', label: t.buttons.unstage },
      { type: 'separator' },
      { id: 'show', label: t.common.showInExplorer, enabled: f.status !== 'D' }
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
              <span>{t.changes.unstaged(status.unstaged.length)}</span>
              {conflicts > 0 && <span className="conflict-hint">{t.changes.conflicts(conflicts)}</span>}
              <button className="small" disabled={!status.unstaged.length} onClick={() => run(t.busy.stageAll, () => git.stageAll(repo))}>
                {t.buttons.stageAll}
              </button>
            </div>
            <FileList
              files={status.unstaged}
              selectedPath={selection && !selection.staged ? selection.path : null}
              onSelect={(f) => setSelection({ path: f.path, staged: false })}
              onDoubleClick={stage}
              onContextMenu={unstagedMenu}
              action={{ icon: <ArrowDownToLine size={14} />, title: t.buttons.stage, onClick: stage }}
            />
          </div>
          <div className="file-section">
            <div className="section-title">
              <span>{t.changes.staged(status.staged.length)}</span>
              <button className="small" disabled={!status.staged.length} onClick={() => run(t.busy.unstageAll, () => git.unstageAll(repo))}>
                {t.buttons.unstageAll}
              </button>
            </div>
            <FileList
              files={status.staged}
              selectedPath={selection?.staged ? selection.path : null}
              onSelect={(f) => setSelection({ path: f.path, staged: true })}
              onDoubleClick={unstage}
              onContextMenu={stagedMenu}
              action={{ icon: <ArrowUpFromLine size={14} />, title: t.buttons.unstage, onClick: unstage }}
            />
          </div>
        </Split>
        <div className="commit-box">
          <textarea
            value={message}
            placeholder={t.changes.commitPlaceholder}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) commit()
            }}
          />
          <div className="commit-actions">
            <label className="checkbox">
              <input type="checkbox" checked={amend} onChange={(e) => toggleAmend(e.target.checked)} />
              {t.changes.amend}
            </label>
            <button className="primary" disabled={!canCommit} onClick={commit}>
              {amend ? 'Amend' : `Commit${status.staged.length ? ` (${status.staged.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
      <DiffView
        diff={selectedFile ? diff : null}
        title={selectedFile ? `${selectedFile.path}${selection?.staged ? t.changes.stagedSuffix : ''}` : undefined}
        hunkActions={hunkActions}
        lineActions={lineActions}
        emptyText={status.staged.length + status.unstaged.length ? t.changes.selectFile : t.changes.noChanges}
      />
    </Split>
  )
}
