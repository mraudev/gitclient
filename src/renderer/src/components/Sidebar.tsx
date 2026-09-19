import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, ChevronDown, ChevronRight, Cloud, FileDiff, Folder, FolderGit2, GitBranch, History, Search, Tag as TagIcon } from 'lucide-react'
import type { Branch, Refs, Stash, StatusResult, Tag, Worktree } from '../../../shared/types'
import { app, git } from '../api'
import { createBranch, deleteBranch, deleteRemoteBranch, dropStash, renameBranch } from '../actions'
import { useRepo, type View } from '../repoContext'

// ---------- Baumstruktur für Branches mit "/" ----------

interface TreeNode<T> {
  name: string
  key: string
  children: TreeNode<T>[]
  item?: T
}

function buildTree<T>(items: T[], pathOf: (t: T) => string, rootKey: string): TreeNode<T>[] {
  const root: TreeNode<T> = { name: '', key: rootKey, children: [] }
  for (const item of items) {
    const parts = pathOf(item).split('/')
    let node = root
    for (const part of parts.slice(0, -1)) {
      let child = node.children.find((c) => !c.item && c.name === part)
      if (!child) {
        child = { name: part, key: `${node.key}/${part}`, children: [] }
        node.children.push(child)
      }
      node = child
    }
    node.children.push({ name: parts[parts.length - 1], key: `${node.key}/${parts[parts.length - 1]}#`, children: [], item })
  }
  const sort = (nodes: TreeNode<T>[]) => {
    nodes.sort((a, b) => Number(!!a.item) - Number(!!b.item) || a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(root.children)
  return root.children
}

// ---------- Zeilen ----------

interface RowProps {
  depth: number
  icon: ReactNode
  label: ReactNode
  title?: string
  extra?: ReactNode
  active?: boolean
  strong?: boolean
  onClick?(): void
  onDoubleClick?(): void
  onContextMenu?(): void
}

function Row({ depth, icon, label, title, extra, active, strong, onClick, onDoubleClick, onContextMenu }: RowProps) {
  return (
    <div
      className={`side-row ${active ? 'active' : ''} ${strong ? 'strong' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      title={title}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.()
      }}
    >
      <span className="side-icon">{icon}</span>
      <span className="side-label">{label}</span>
      {extra}
    </div>
  )
}

function Section({ title, count, open, onToggle, children }: { title: string; count: number; open: boolean; onToggle(): void; children: ReactNode }) {
  return (
    <div className="side-section">
      <div className="side-section-title" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
        <span className="count">{count}</span>
      </div>
      {open && children}
    </div>
  )
}

function TrackInfo({ branch }: { branch: Branch }) {
  if (branch.gone) return <span className="track gone" title="Upstream existiert nicht mehr">gone</span>
  if (!branch.ahead && !branch.behind) return null
  return (
    <span className="track" title={`${branch.ahead} voraus, ${branch.behind} zurück gegenüber ${branch.upstream}`}>
      {branch.ahead > 0 && `↑${branch.ahead}`}
      {branch.behind > 0 && ` ↓${branch.behind}`}
    </span>
  )
}

// ---------- Sidebar ----------

const COLLAPSED_KEY = 'sidebar:collapsed'

interface Props {
  refs: Refs
  status: StatusResult
  view: View
  onView(view: View): void
}

export function Sidebar({ refs, status, view, onView }: Props) {
  const { repo, run, jumpTo, openRepo } = useRepo()
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '["sec:tags"]') as string[])
    } catch {
      return new Set()
    }
  })

  useEffect(() => localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed])), [collapsed])

  const isOpen = (key: string) => filter !== '' || !collapsed.has(key)
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const f = filter.toLowerCase()
  const match = (name: string) => name.toLowerCase().includes(f)
  const localTree = useMemo(() => buildTree(refs.local.filter((b) => match(b.name)), (b) => b.name, 'local'), [refs.local, f])
  const tags = refs.tags.filter((t) => match(t.name))
  const stashes = refs.stashes.filter((s) => match(s.message))
  const changeCount = status.staged.length + status.unstaged.length

  // ----- Kontextmenüs -----

  const localMenu = async (b: Branch) => {
    const choice = await app.contextMenu([
      { id: 'checkout', label: 'Auschecken', enabled: !b.isHead },
      { id: 'branch', label: 'Neuer Branch von hier…' },
      { type: 'separator' },
      { id: 'rename', label: 'Umbenennen…' },
      { id: 'delete', label: 'Löschen…', enabled: !b.isHead }
    ])
    if (choice === 'checkout') void run(`Checkout ${b.name}`, () => git.checkout(repo, b.name))
    if (choice === 'branch') void run('Branch erstellen', () => createBranch(repo, b.name, b.name))
    if (choice === 'rename') void run('Umbenennen', () => renameBranch(repo, b.name))
    if (choice === 'delete') void run('Löschen', () => deleteBranch(repo, b.name))
  }

  const checkoutRemote = (b: Branch) => run(`Checkout ${b.name}`, () => git.checkoutRemote(repo, b.name, b.remote!))

  const remoteMenu = async (b: Branch) => {
    const choice = await app.contextMenu([
      { id: 'checkout', label: 'Auschecken (lokalen Branch anlegen)' },
      { id: 'branch', label: 'Neuer Branch von hier…' },
      { type: 'separator' },
      { id: 'delete', label: `Auf ${b.remote} löschen…` }
    ])
    if (choice === 'checkout') void checkoutRemote(b)
    if (choice === 'branch') void run('Branch erstellen', () => createBranch(repo, b.name, b.name))
    if (choice === 'delete') void run('Remote-Branch löschen', () => deleteRemoteBranch(repo, b.name, b.remote!))
  }

  const tagMenu = async (t: Tag) => {
    const choice = await app.contextMenu([
      { id: 'checkout', label: 'Auschecken (detached HEAD)' },
      { id: 'branch', label: 'Neuer Branch von hier…' }
    ])
    if (choice === 'checkout') void run(`Checkout ${t.name}`, () => git.checkoutDetached(repo, t.name))
    if (choice === 'branch') void run('Branch erstellen', () => createBranch(repo, t.name, t.name))
  }

  const stashMenu = async (s: Stash) => {
    const choice = await app.contextMenu([
      { id: 'apply', label: 'Anwenden' },
      { id: 'pop', label: 'Anwenden und löschen (pop)' },
      { type: 'separator' },
      { id: 'drop', label: 'Löschen…' }
    ])
    if (choice === 'apply') void run('Stash anwenden', () => git.stashApply(repo, s.ref))
    if (choice === 'pop') void run('Stash anwenden', () => git.stashPop(repo, s.ref))
    if (choice === 'drop') {
      void run('Stash löschen', async () => {
        await dropStash(repo, s)
        if (view.kind === 'stash' && view.stash.ref === s.ref) onView({ kind: 'history' })
      })
    }
  }

  const worktreeMenu = async (w: Worktree) => {
    const choice = await app.contextMenu([
      { id: 'open', label: 'Öffnen', enabled: !w.isCurrent },
      { id: 'show', label: 'Im Explorer anzeigen' }
    ])
    if (choice === 'open') openRepo(w.path)
    if (choice === 'show') void app.showInFolder(w.path)
  }

  // ----- Rendering -----

  const renderTree = <T,>(nodes: TreeNode<T>[], depth: number, renderItem: (item: T, name: string, depth: number) => ReactNode): ReactNode =>
    nodes.map((node) =>
      node.item ? (
        <div key={node.key}>{renderItem(node.item, node.name, depth)}</div>
      ) : (
        <div key={node.key}>
          <Row
            depth={depth}
            icon={isOpen(node.key) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            label={
              <>
                <Folder size={13} className="folder-icon" /> {node.name}
              </>
            }
            onClick={() => toggle(node.key)}
          />
          {isOpen(node.key) && renderTree(node.children, depth + 1, renderItem)}
        </div>
      )
    )

  const renderLocal = (b: Branch, name: string, depth: number) => (
    <Row
      depth={depth}
      icon={<GitBranch size={14} />}
      label={name}
      title={b.upstream ? `${b.name} → ${b.upstream}` : b.name}
      strong={b.isHead}
      extra={<TrackInfo branch={b} />}
      onClick={() => jumpTo(b.hash)}
      onDoubleClick={() => !b.isHead && run(`Checkout ${b.name}`, () => git.checkout(repo, b.name))}
      onContextMenu={() => localMenu(b)}
    />
  )

  const renderRemote = (b: Branch, name: string, depth: number) => (
    <Row
      depth={depth}
      icon={<GitBranch size={14} />}
      label={name}
      title={b.name}
      onClick={() => jumpTo(b.hash)}
      onDoubleClick={() => checkoutRemote(b)}
      onContextMenu={() => remoteMenu(b)}
    />
  )

  return (
    <div className="sidebar">
      <div className="side-search">
        <Search size={13} />
        <input value={filter} placeholder="Filtern…" onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="side-scroll">
        <Row
          depth={0}
          icon={<FileDiff size={14} />}
          label="Lokale Änderungen"
          active={view.kind === 'changes'}
          extra={changeCount > 0 && <span className="pill">{changeCount}</span>}
          onClick={() => onView({ kind: 'changes' })}
        />
        <Row depth={0} icon={<History size={14} />} label="Alle Commits" active={view.kind === 'history'} onClick={() => onView({ kind: 'history' })} />

        <Section title="Branches" count={refs.local.length} open={isOpen('sec:local')} onToggle={() => toggle('sec:local')}>
          {renderTree(localTree, 1, renderLocal)}
        </Section>

        <Section title="Remotes" count={refs.remotes.length} open={isOpen('sec:remotes')} onToggle={() => toggle('sec:remotes')}>
          {refs.remotes.map((remote) => {
            const key = `remote:${remote}`
            const branches = refs.remote.filter((b) => b.remote === remote && match(b.name))
            return (
              <div key={remote}>
                <Row
                  depth={1}
                  icon={isOpen(key) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  label={
                    <>
                      <Cloud size={13} className="folder-icon" /> {remote}
                    </>
                  }
                  onClick={() => toggle(key)}
                />
                {isOpen(key) && renderTree(buildTree(branches, (b) => b.name.slice(remote.length + 1), key), 2, renderRemote)}
              </div>
            )
          })}
        </Section>

        <Section title="Tags" count={refs.tags.length} open={isOpen('sec:tags')} onToggle={() => toggle('sec:tags')}>
          {tags.map((t) => (
            <Row key={t.name} depth={1} icon={<TagIcon size={14} />} label={t.name} onClick={() => jumpTo(t.hash)} onContextMenu={() => tagMenu(t)} />
          ))}
        </Section>

        <Section title="Stashes" count={refs.stashes.length} open={isOpen('sec:stashes')} onToggle={() => toggle('sec:stashes')}>
          {stashes.map((s) => (
            <Row
              key={s.ref}
              depth={1}
              icon={<Archive size={14} />}
              label={s.message}
              title={`${s.ref}: ${s.message}`}
              active={view.kind === 'stash' && view.stash.ref === s.ref}
              onClick={() => onView({ kind: 'stash', stash: s })}
              onContextMenu={() => stashMenu(s)}
            />
          ))}
        </Section>

        <Section title="Worktrees" count={refs.worktrees.length} open={isOpen('sec:worktrees')} onToggle={() => toggle('sec:worktrees')}>
          {refs.worktrees.map((w) => (
            <Row
              key={w.path}
              depth={1}
              icon={<FolderGit2 size={14} />}
              label={w.branch ?? `(detached ${w.head.slice(0, 7)})`}
              title={`${w.path}${w.isMain ? ' (Haupt-Worktree)' : ''}${w.locked ? ' – gesperrt' : ''}${w.prunable ? ' – verwaist' : ''}`}
              strong={w.isCurrent}
              extra={w.isMain && <span className="track">Haupt</span>}
              onDoubleClick={() => !w.isCurrent && openRepo(w.path)}
              onContextMenu={() => worktreeMenu(w)}
            />
          ))}
        </Section>
      </div>
    </div>
  )
}
