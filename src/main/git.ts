import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { GitApi } from '../shared/api'
import type {
  Branch,
  Commit,
  CommitDetails,
  FileChange,
  FileStatus,
  RefLabel,
  Refs,
  Stash,
  StatusResult,
  Tag,
  Worktree
} from '../shared/types'

const FS = '\x1f' // Feldtrenner
const RS = '\x1e' // Datensatztrenner
const COMMIT_FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%D', '%s'].join('%x1f')
const MAX_UNTRACKED_PREVIEW = 2 * 1024 * 1024

interface RunOptions {
  input?: string
  okExitCodes?: number[]
  env?: Record<string, string>
}

export function runGit(cwd: string, args: string[], opts: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args], {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', ...opts.env }
    })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (d: Buffer) => out.push(d))
    child.stderr.on('data', (d: Buffer) => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 || opts.okExitCodes?.includes(code ?? -1)) {
        resolve(Buffer.concat(out).toString('utf8'))
      } else {
        const msg = Buffer.concat(err).toString('utf8').trim()
        reject(new Error(msg || `git ${args[0]} fehlgeschlagen (Exit-Code ${code})`))
      }
    })
    child.stdin.end(opts.input ?? '')
  })
}

/** Liefert das Wurzelverzeichnis des Repos, in dem `dir` liegt, oder wirft. */
export async function repoRoot(dir: string): Promise<string> {
  const out = await runGit(dir, ['rev-parse', '--show-toplevel'])
  return path.normalize(out.trim())
}

async function hasHead(repo: string): Promise<boolean> {
  const out = await runGit(repo, ['rev-parse', '--verify', '-q', 'HEAD'], { okExitCodes: [1] })
  return out.trim().length > 0
}

function parseRefLabels(decoration: string): RefLabel[] {
  if (!decoration) return []
  const labels: RefLabel[] = []
  for (const part of decoration.split(', ')) {
    if (part === 'HEAD') {
      labels.push({ kind: 'head', name: 'HEAD' })
    } else if (part.startsWith('HEAD -> ')) {
      labels.push({ kind: 'local', name: part.slice('HEAD -> refs/heads/'.length), current: true })
    } else if (part.startsWith('tag: refs/tags/')) {
      labels.push({ kind: 'tag', name: part.slice('tag: refs/tags/'.length) })
    } else if (part.startsWith('refs/heads/')) {
      labels.push({ kind: 'local', name: part.slice('refs/heads/'.length) })
    } else if (part.startsWith('refs/remotes/') && !part.endsWith('/HEAD')) {
      labels.push({ kind: 'remote', name: part.slice('refs/remotes/'.length) })
    }
  }
  return labels
}

function parseCommit(fields: string[]): Commit {
  const [hash, parents, author, email, date, decoration, subject] = fields
  return {
    hash,
    parents: parents ? parents.split(' ') : [],
    author,
    email,
    date: Number(date) * 1000,
    subject,
    refs: parseRefLabels(decoration)
  }
}

function parseNameStatus(out: string): FileChange[] {
  const tokens = out.split('\0')
  const files: FileChange[] = []
  for (let i = 0; i < tokens.length; ) {
    const code = tokens[i++]
    if (!code) continue
    const status = code[0] as FileStatus
    if (status === 'R' || status === 'C') {
      const oldPath = tokens[i++]
      files.push({ status, oldPath, path: tokens[i++] })
    } else {
      files.push({ status, path: tokens[i++] })
    }
  }
  return files
}

function pathsOf(file: FileChange): string[] {
  return file.oldPath ? [file.oldPath, file.path] : [file.path]
}

async function untrackedDiff(repo: string, file: string): Promise<string> {
  const full = path.join(repo, file)
  const stat = await fs.stat(full)
  const header = `diff --git a/${file} b/${file}\nnew file\n--- /dev/null\n+++ b/${file}\n`
  if (stat.size > MAX_UNTRACKED_PREVIEW) return `${header}Datei zu groß für die Vorschau\n`
  const buf = await fs.readFile(full)
  if (buf.subarray(0, 8000).includes(0)) return `${header}Binary files /dev/null and b/${file} differ\n`
  const text = buf.toString('utf8')
  if (text.length === 0) return header
  const lines = text.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return `${header}@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => '+' + l).join('\n')}\n`
}

async function status(repo: string): Promise<StatusResult> {
  const out = await runGit(repo, ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all'])
  const result: StatusResult = { branch: null, detached: false, ahead: 0, behind: 0, staged: [], unstaged: [] }
  const tokens = out.split('\0')
  for (let i = 0; i < tokens.length; i++) {
    const line = tokens[i]
    if (!line) continue
    const parts = line.split(' ')
    switch (line[0]) {
      case '#': {
        if (parts[1] === 'branch.head') {
          result.detached = parts[2] === '(detached)'
          result.branch = result.detached ? null : parts.slice(2).join(' ')
        } else if (parts[1] === 'branch.upstream') {
          result.upstream = parts[2]
        } else if (parts[1] === 'branch.ab') {
          result.ahead = Number(parts[2].slice(1))
          result.behind = Number(parts[3].slice(1))
        }
        break
      }
      case '1':
      case '2': {
        const [x, y] = parts[1]
        const file = parts.slice(line[0] === '1' ? 8 : 9).join(' ')
        const oldPath = line[0] === '2' ? tokens[++i] : undefined
        if (x !== '.') result.staged.push({ status: x as FileStatus, path: file, oldPath })
        if (y !== '.') result.unstaged.push({ status: y as FileStatus, path: file })
        break
      }
      case 'u':
        result.unstaged.push({ status: 'U', path: parts.slice(10).join(' ') })
        break
      case '?':
        result.unstaged.push({ status: '?', path: line.slice(2) })
        break
    }
  }
  return result
}

function parseTrack(track: string): { ahead: number; behind: number; gone: boolean } {
  return {
    ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
    behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
    gone: track === 'gone'
  }
}

async function branchesAndTags(repo: string): Promise<{ local: Branch[]; remote: Branch[]; tags: Tag[] }> {
  const format = ['%(refname)', '%(objectname)', '%(upstream:short)', '%(upstream:track,nobracket)', '%(HEAD)', '%(*objectname)'].join('%1f')
  // LC_ALL=C, damit "ahead/behind" nicht übersetzt wird
  const out = await runGit(repo, ['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes', 'refs/tags'], {
    env: { LC_ALL: 'C' }
  })
  const local: Branch[] = []
  const remote: Branch[] = []
  const tags: Tag[] = []
  for (const line of out.split('\n')) {
    if (!line) continue
    const [ref, hash, upstream, track, head, peeled] = line.split(FS)
    if (ref.startsWith('refs/heads/')) {
      local.push({ name: ref.slice(11), hash, upstream: upstream || undefined, ...parseTrack(track), isHead: head === '*' })
    } else if (ref.startsWith('refs/remotes/')) {
      if (ref.endsWith('/HEAD')) continue
      const name = ref.slice(13)
      remote.push({ name, hash, remote: name.split('/')[0], ahead: 0, behind: 0, gone: false, isHead: false })
    } else if (ref.startsWith('refs/tags/')) {
      tags.push({ name: ref.slice(10), hash: peeled || hash })
    }
  }
  return { local, remote, tags }
}

async function stashes(repo: string): Promise<Stash[]> {
  const out = await runGit(repo, ['stash', 'list', `--format=%gd%x1f%H%x1f%ct%x1f%gs%x1e`])
  return out
    .split(RS)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rec, index) => {
      const [ref, hash, date, message] = rec.split(FS)
      return { index, ref, hash, date: Number(date) * 1000, message }
    })
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => path.resolve(p).toLowerCase()
  return process.platform === 'win32' ? norm(a) === norm(b) : path.resolve(a) === path.resolve(b)
}

async function worktrees(repo: string): Promise<Worktree[]> {
  const out = await runGit(repo, ['worktree', 'list', '--porcelain'])
  const result: Worktree[] = []
  for (const block of out.split(/\n\n+/)) {
    if (!block.trim()) continue
    const wt: Worktree = { path: '', head: '', isMain: result.length === 0, isCurrent: false, locked: false, prunable: false }
    for (const line of block.split('\n')) {
      const [key, ...rest] = line.split(' ')
      const value = rest.join(' ')
      if (key === 'worktree') wt.path = path.normalize(value)
      else if (key === 'HEAD') wt.head = value
      else if (key === 'branch') wt.branch = value.replace(/^refs\/heads\//, '')
      else if (key === 'locked') wt.locked = true
      else if (key === 'prunable') wt.prunable = true
    }
    wt.isCurrent = samePath(wt.path, repo)
    result.push(wt)
  }
  return result
}

async function refs(repo: string): Promise<Refs> {
  const [bt, stashList, wts, remotesOut] = await Promise.all([
    branchesAndTags(repo),
    stashes(repo),
    worktrees(repo),
    runGit(repo, ['remote'])
  ])
  return { ...bt, stashes: stashList, worktrees: wts, remotes: remotesOut.split('\n').filter(Boolean) }
}

async function log(repo: string, limit: number): Promise<Commit[]> {
  const head = await hasHead(repo)
  const args = ['log', '--branches', '--remotes', '--tags', '--date-order', '--decorate=full', `-n${limit}`, `--format=${COMMIT_FORMAT}%x1e`]
  if (head) args.push('HEAD')
  let out: string
  try {
    out = await runGit(repo, args)
  } catch (e) {
    if (!head) return [] // leeres Repo ohne Commits
    throw e
  }
  return out
    .split(RS)
    .map((s) => s.replace(/^\n/, ''))
    .filter(Boolean)
    .map((rec) => parseCommit(rec.split(FS)))
}

async function commitDetails(repo: string, hash: string): Promise<CommitDetails> {
  const format = `${COMMIT_FORMAT}%x1f%cn%x1f%ce%x1f%ct%x1f%b`
  const out = await runGit(repo, ['show', '-s', '--decorate=full', `--format=${format}`, hash])
  const fields = out.split(FS)
  const commit = parseCommit(fields)
  const [committer, committerEmail, committerDate, ...body] = fields.slice(7)
  const filesOut = commit.parents.length
    ? await runGit(repo, ['diff', '--name-status', '-z', '-M', commit.parents[0], hash])
    : await runGit(repo, ['diff-tree', '--root', '--no-commit-id', '-r', '--name-status', '-z', '-M', hash])
  return {
    ...commit,
    committer,
    committerEmail,
    committerDate: Number(committerDate) * 1000,
    body: body.join(FS).trim(),
    files: parseNameStatus(filesOut)
  }
}

async function currentBranch(repo: string): Promise<string> {
  const s = await status(repo)
  if (!s.branch) throw new Error('Kein Branch ausgecheckt (detached HEAD).')
  return s.branch
}

export const gitApi: GitApi = {
  status,
  refs,
  log,
  commitDetails,

  async commitFileDiff(repo, hash, file) {
    const parents = (await runGit(repo, ['rev-list', '--parents', '-n1', hash])).trim().split(' ').slice(1)
    return parents.length
      ? runGit(repo, ['diff', '-M', parents[0], hash, '--', ...pathsOf(file)])
      : runGit(repo, ['show', '--format=', hash, '--', file.path])
  },

  async fileDiff(repo, file, staged) {
    if (staged) return runGit(repo, ['diff', '--cached', '-M', '--', ...pathsOf(file)])
    if (file.status === '?') return untrackedDiff(repo, file.path)
    return runGit(repo, ['diff', '--', file.path])
  },

  async lastCommitMessage(repo) {
    return (await runGit(repo, ['log', '-1', '--format=%B'])).trim()
  },

  async stage(repo, paths) {
    await runGit(repo, ['add', '-A', '--', ...paths])
  },

  async unstage(repo, paths) {
    if (await hasHead(repo)) await runGit(repo, ['restore', '--staged', '--', ...paths])
    else await runGit(repo, ['rm', '--cached', '-r', '-q', '--', ...paths])
  },

  async stageAll(repo) {
    await runGit(repo, ['add', '-A'])
  },

  async unstageAll(repo) {
    if (await hasHead(repo)) await runGit(repo, ['reset', '-q'])
    else await runGit(repo, ['rm', '--cached', '-r', '-q', '.'])
  },

  async discard(repo, files) {
    const untracked = files.filter((f) => f.status === '?').map((f) => f.path)
    const tracked = files.filter((f) => f.status !== '?').map((f) => f.path)
    if (untracked.length) await runGit(repo, ['clean', '-f', '-q', '--', ...untracked])
    if (tracked.length) await runGit(repo, ['restore', '--worktree', '--', ...tracked])
  },

  async commit(repo, message, amend) {
    await runGit(repo, ['commit', '-F', '-', ...(amend ? ['--amend'] : [])], { input: message })
  },

  async checkout(repo, branch) {
    await runGit(repo, ['switch', branch])
  },

  async checkoutRemote(repo, remoteBranch, remote) {
    const local = remoteBranch.slice(remote.length + 1)
    const exists = await runGit(repo, ['rev-parse', '--verify', '-q', `refs/heads/${local}`], { okExitCodes: [1] })
    if (exists.trim()) await runGit(repo, ['switch', local])
    else await runGit(repo, ['switch', '-c', local, '--track', remoteBranch])
  },

  async checkoutDetached(repo, rev) {
    await runGit(repo, ['switch', '--detach', rev])
  },

  async createBranch(repo, name, startPoint, checkout) {
    if (checkout) await runGit(repo, ['switch', '-c', name, startPoint])
    else await runGit(repo, ['branch', name, startPoint])
  },

  async renameBranch(repo, oldName, newName) {
    await runGit(repo, ['branch', '-m', oldName, newName])
  },

  async deleteBranch(repo, name, force) {
    await runGit(repo, ['branch', force ? '-D' : '-d', name])
  },

  async deleteRemoteBranch(repo, remoteBranch, remote) {
    await runGit(repo, ['push', remote, '--delete', remoteBranch.slice(remote.length + 1)])
  },

  async fetch(repo) {
    await runGit(repo, ['fetch', '--all', '--prune'])
  },

  async pull(repo) {
    await runGit(repo, ['pull'])
  },

  async push(repo) {
    const s = await status(repo)
    if (s.upstream) {
      await runGit(repo, ['push'])
      return
    }
    const branch = await currentBranch(repo)
    const remotes = (await runGit(repo, ['remote'])).split('\n').filter(Boolean)
    if (remotes.length === 0) throw new Error('Es ist kein Remote konfiguriert.')
    const remote = remotes.includes('origin') ? 'origin' : remotes[0]
    await runGit(repo, ['push', '-u', remote, branch])
  },

  async stashSave(repo, message, includeUntracked) {
    await runGit(repo, ['stash', 'push', ...(includeUntracked ? ['-u'] : []), ...(message ? ['-m', message] : [])])
  },

  async stashApply(repo, ref) {
    await runGit(repo, ['stash', 'apply', ref])
  },

  async stashPop(repo, ref) {
    await runGit(repo, ['stash', 'pop', ref])
  },

  async stashDrop(repo, ref) {
    await runGit(repo, ['stash', 'drop', ref])
  }
}
