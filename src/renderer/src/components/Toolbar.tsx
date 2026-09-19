import { Archive, ArrowDown, ArrowUp, ChevronDown, FolderGit2, GitBranch, Loader2, RefreshCw, CloudDownload } from 'lucide-react'
import type { StatusResult } from '../../../shared/types'
import { app, git } from '../api'
import { createBranch, saveStash } from '../actions'
import { notifyError } from '../dialogs'
import { t } from '../i18n'
import { useRepo } from '../repoContext'

interface Props {
  repoName: string
  status: StatusResult
  busy: string | null
  onRefresh(): void
}

export function Toolbar({ repoName, status, busy, onRefresh }: Props) {
  const { repo, run, openRepo } = useRepo()
  const hasChanges = status.staged.length + status.unstaged.length > 0

  const repoMenu = async () => {
    const recent = (await app.recentRepos()).filter((r) => r.path !== repo)
    const choice = await app.contextMenu([
      ...recent.map((r) => ({ id: `open:${r.path}`, label: `${r.name}  —  ${r.path}` })),
      ...(recent.length ? [{ type: 'separator' as const }] : []),
      { id: 'dialog', label: t.common.openRepoEllipsis },
      { id: 'show', label: t.common.showInExplorer }
    ])
    if (choice?.startsWith('open:')) openRepo(choice.slice(5))
    if (choice === 'show') void app.showInFolder(repo)
    if (choice === 'dialog') {
      try {
        const info = await app.openRepoDialog()
        if (info) openRepo(info.path)
      } catch (e) {
        notifyError(e)
      }
    }
  }

  const head = status.branch ?? 'detached HEAD'

  return (
    <div className="toolbar">
      <button className="repo-button" onClick={repoMenu} title={repo}>
        <FolderGit2 size={16} />
        <span className="repo-name">{repoName}</span>
        <ChevronDown size={14} />
      </button>
      <div className="head-info" title={status.upstream ? t.toolbar.upstream(status.upstream) : t.toolbar.noUpstream}>
        <GitBranch size={14} />
        <span>{head}</span>
      </div>

      <div className="tool-group">
        <button className="tool" disabled={!!busy} onClick={() => run('Fetch', () => git.fetch(repo))} title={t.toolbar.fetchTitle}>
          <CloudDownload size={18} />
          <span>Fetch</span>
        </button>
        <button className="tool" disabled={!!busy} onClick={() => run('Pull', () => git.pull(repo))} title="Pull">
          <ArrowDown size={18} />
          <span>Pull{status.behind > 0 && <em className="count-badge">{status.behind}</em>}</span>
        </button>
        <button className="tool" disabled={!!busy || !status.branch} onClick={() => run('Push', () => git.push(repo))} title="Push">
          <ArrowUp size={18} />
          <span>Push{status.ahead > 0 && <em className="count-badge">{status.ahead}</em>}</span>
        </button>
      </div>

      <div className="tool-group">
        <button className="tool" disabled={!!busy} onClick={() => run(t.busy.createBranch, () => createBranch(repo, 'HEAD', head))} title={t.toolbar.branchTitle}>
          <GitBranch size={18} />
          <span>Branch</span>
        </button>
        <button className="tool" disabled={!!busy || !hasChanges} onClick={() => run('Stash', () => saveStash(repo))} title={t.toolbar.stashTitle}>
          <Archive size={18} />
          <span>Stash</span>
        </button>
      </div>

      <div className="toolbar-spacer" />
      {busy && (
        <div className="busy">
          <Loader2 size={14} className="spin" />
          {busy}…
        </div>
      )}
      <button className="icon" onClick={onRefresh} title={t.toolbar.refresh}>
        <RefreshCw size={16} />
      </button>
    </div>
  )
}
