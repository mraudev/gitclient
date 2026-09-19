import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Commit, Refs, RepoInfo, StatusResult } from '../../../shared/types'
import { app, git, useMenuAction } from '../api'
import { createBranch, saveStash } from '../actions'
import { notify, notifyError } from '../dialogs'
import { t } from '../i18n'
import { computeGraph } from '../lib/graph'
import { shortHash } from '../lib/format'
import { RepoContext, type RepoCtx, type View } from '../repoContext'
import { ChangesView } from './ChangesView'
import { CommitDetails } from './CommitDetails'
import { CommitList } from './CommitList'
import { Sidebar } from './Sidebar'
import { Split } from './Split'
import { Toolbar } from './Toolbar'

const PAGE = 1000

export function RepoView({ repo, openRepo }: { repo: RepoInfo; openRepo(path: string): void }) {
  const [status, setStatus] = useState<StatusResult | null>(null)
  const [refs, setRefs] = useState<Refs | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [view, setView] = useState<View>({ kind: 'history' })
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const loadSeq = useRef(0)
  const graph = useMemo(() => computeGraph(commits), [commits])

  const refresh = useCallback(async () => {
    const seq = ++loadSeq.current
    try {
      const [s, r, c] = await Promise.all([git.status(repo.path), git.refs(repo.path), git.log(repo.path, limit)])
      if (seq !== loadSeq.current) return // eine neuere Aktualisierung läuft bereits
      setStatus(s)
      setRefs(r)
      setCommits(c)
    } catch (e) {
      if (seq === loadSeq.current) notifyError(e)
    }
  }, [repo.path, limit])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  // Beim ersten Laden den HEAD-Commit auswählen
  useEffect(() => {
    if (selectedHash || commits.length === 0) return
    const head = commits.find((c) => c.refs.some((r) => r.current || r.kind === 'head'))
    setSelectedHash((head ?? commits[0]).hash)
  }, [commits])

  // Angezeigter Stash wurde angewendet/gelöscht
  useEffect(() => {
    if (view.kind === 'stash' && refs && !refs.stashes.some((s) => s.hash === view.stash.hash)) setView({ kind: 'history' })
  }, [refs])

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setBusy(label)
      try {
        await fn()
      } catch (e) {
        notifyError(e)
      } finally {
        setBusy(null)
        await refresh()
      }
    },
    [refresh]
  )

  const jumpTo = useCallback(
    (hash: string) => {
      setView({ kind: 'history' })
      setSelectedHash(hash)
      if (!commits.some((c) => c.hash === hash)) notify(t.history.notLoaded(shortHash(hash)))
    },
    [commits]
  )

  // Repo-bezogene Aktionen aus dem Hauptmenü (Öffnen/Schließen/Einstellungen behandelt App)
  useMenuAction((action) => {
    if (action === 'view-changes') setView({ kind: 'changes' })
    if (action === 'view-history') setView({ kind: 'history' })
    if (action === 'refresh') void refresh()
    if (action === 'show-in-explorer') void app.showInFolder(repo.path)
    if (busy || !status) return // wie die Toolbar-Buttons: keine zweite Git-Aktion gleichzeitig
    if (action === 'fetch') void run('Fetch', () => git.fetch(repo.path))
    if (action === 'pull') void run('Pull', () => git.pull(repo.path))
    if (action === 'push') void run('Push', () => git.push(repo.path))
    if (action === 'new-branch') void run(t.busy.createBranch, () => createBranch(repo.path, 'HEAD', status.branch ?? 'detached HEAD'))
    if (action === 'stash' && status.staged.length + status.unstaged.length > 0) void run('Stash', () => saveStash(repo.path))
  })

  const ctx: RepoCtx = useMemo(() => ({ repo: repo.path, run, jumpTo, openRepo }), [repo.path, run, jumpTo, openRepo])

  const commitMenu = async (c: Commit) => {
    const choice = await app.contextMenu([
      { id: 'branch', label: t.common.newBranchHere },
      { id: 'checkout', label: t.common.checkoutDetached },
      { type: 'separator' },
      { id: 'copy', label: t.history.copyHash }
    ])
    if (choice === 'branch') void run(t.busy.createBranch, () => createBranch(repo.path, c.hash, shortHash(c.hash)))
    if (choice === 'checkout') void run(`Checkout ${shortHash(c.hash)}`, () => git.checkoutDetached(repo.path, c.hash))
    if (choice === 'copy') {
      void navigator.clipboard.writeText(c.hash)
      notify(t.common.hashCopied)
    }
  }

  if (!status || !refs) return <div className="placeholder full">{t.history.loadingRepo}</div>

  let content
  if (view.kind === 'changes') {
    content = <ChangesView status={status} />
  } else if (view.kind === 'stash') {
    content = (
      <div className="stash-view">
        <div className="view-title">
          {view.stash.ref}: {view.stash.message}
        </div>
        <CommitDetails hash={view.stash.hash} />
      </div>
    )
  } else {
    content = (
      <Split direction="column" initial={420} storageKey="history" min={120}>
        <CommitList
          commits={commits}
          graph={graph}
          selectedHash={selectedHash}
          onSelect={setSelectedHash}
          onContextMenu={commitMenu}
          hasMore={commits.length >= limit}
          onLoadMore={() => setLimit((l) => l + PAGE)}
        />
        {selectedHash ? <CommitDetails hash={selectedHash} /> : <div className="placeholder">{t.history.selectCommit}</div>}
      </Split>
    )
  }

  return (
    <RepoContext.Provider value={ctx}>
      <div className="repo-view">
        <Toolbar repoName={repo.name} status={status} busy={busy} onRefresh={refresh} />
        <div className="repo-body">
          <Split direction="row" initial={260} storageKey="sidebar" min={180}>
            <Sidebar refs={refs} status={status} view={view} onView={setView} />
            <main className="content">{content}</main>
          </Split>
        </div>
      </div>
    </RepoContext.Provider>
  )
}
