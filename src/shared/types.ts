export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | '?'

export interface FileChange {
  path: string
  oldPath?: string
  status: FileStatus
}

export interface StatusResult {
  branch: string | null
  detached: boolean
  upstream?: string
  ahead: number
  behind: number
  staged: FileChange[]
  unstaged: FileChange[]
}

export type RefKind = 'head' | 'local' | 'remote' | 'tag'

export interface RefLabel {
  kind: RefKind
  name: string
  /** Lokaler Branch, auf den HEAD zeigt */
  current?: boolean
}

export interface Commit {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  subject: string
  refs: RefLabel[]
}

export interface CommitDetails extends Commit {
  body: string
  committer: string
  committerEmail: string
  committerDate: number
  files: FileChange[]
}

export interface Branch {
  name: string
  hash: string
  upstream?: string
  ahead: number
  behind: number
  gone: boolean
  isHead: boolean
  remote?: string
}

export interface Tag {
  name: string
  hash: string
}

export interface Stash {
  index: number
  ref: string
  hash: string
  message: string
  date: number
}

export interface Worktree {
  path: string
  head: string
  branch?: string
  isMain: boolean
  isCurrent: boolean
  locked: boolean
  prunable: boolean
}

export interface Refs {
  local: Branch[]
  remote: Branch[]
  remotes: string[]
  tags: Tag[]
  stashes: Stash[]
  worktrees: Worktree[]
}

export interface RepoInfo {
  path: string
  name: string
}

export interface MenuItem {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
}

export type Language = 'en' | 'de'

/** Aktionen aus dem Hauptmenü, die der Hauptprozess an die Oberfläche weiterreicht (Kanal "menu"). */
export type MenuAction =
  | 'open-repo'
  | 'open-recent' // Argument: Repo-Pfad
  | 'close-repo'
  | 'settings'
  | 'view-changes'
  | 'view-history'
  | 'refresh'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'new-branch'
  | 'stash'
  | 'show-in-explorer'

/** Steht im Diff einer untracked Datei statt des Inhalts, wenn sie zu groß für die Vorschau ist. */
export const PREVIEW_TOO_LARGE = 'gitclient:preview-too-large'

export interface ConfirmOptions {
  message: string
  detail?: string
  confirmLabel: string
}
