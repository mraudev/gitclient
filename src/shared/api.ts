import type {
  Commit,
  CommitDetails,
  ConfirmOptions,
  FileChange,
  Language,
  MenuItem,
  Refs,
  RepoInfo,
  StatusResult
} from './types'

/** Git-Operationen, erreichbar über IPC-Kanäle `git:<name>`. Erstes Argument ist immer der Repo-Pfad. */
export interface GitApi {
  status(repo: string): Promise<StatusResult>
  refs(repo: string): Promise<Refs>
  log(repo: string, limit: number): Promise<Commit[]>
  commitDetails(repo: string, hash: string): Promise<CommitDetails>
  commitFileDiff(repo: string, hash: string, file: FileChange): Promise<string>
  fileDiff(repo: string, file: FileChange, staged: boolean): Promise<string>
  lastCommitMessage(repo: string): Promise<string>

  stage(repo: string, paths: string[]): Promise<void>
  unstage(repo: string, paths: string[]): Promise<void>
  stageAll(repo: string): Promise<void>
  unstageAll(repo: string): Promise<void>
  discard(repo: string, files: FileChange[]): Promise<void>
  /** Wendet einen Patch auf den Index an (reverse = aus dem Index entfernen). Grundlage für Hunk-Staging. */
  applyToIndex(repo: string, patch: string, reverse: boolean): Promise<void>
  /** Nimmt einen Patch im Arbeitsverzeichnis zurück (Hunk verwerfen). */
  discardPatch(repo: string, patch: string): Promise<void>
  commit(repo: string, message: string, amend: boolean): Promise<void>

  checkout(repo: string, branch: string): Promise<void>
  checkoutRemote(repo: string, remoteBranch: string, remote: string): Promise<void>
  checkoutDetached(repo: string, rev: string): Promise<void>
  createBranch(repo: string, name: string, startPoint: string, checkout: boolean): Promise<void>
  renameBranch(repo: string, oldName: string, newName: string): Promise<void>
  deleteBranch(repo: string, name: string, force: boolean): Promise<void>
  deleteRemoteBranch(repo: string, remoteBranch: string, remote: string): Promise<void>

  fetch(repo: string): Promise<void>
  pull(repo: string): Promise<void>
  push(repo: string): Promise<void>

  stashSave(repo: string, message: string, includeUntracked: boolean): Promise<void>
  stashApply(repo: string, ref: string): Promise<void>
  stashPop(repo: string, ref: string): Promise<void>
  stashDrop(repo: string, ref: string): Promise<void>
}

/** App-/Fenster-Funktionen, erreichbar über IPC-Kanäle `app:<name>`. */
export interface AppApi {
  openRepoDialog(): Promise<RepoInfo | null>
  openRepo(path: string): Promise<RepoInfo>
  recentRepos(): Promise<RepoInfo[]>
  removeRecent(path: string): Promise<void>
  contextMenu(items: MenuItem[]): Promise<string | null>
  confirm(options: ConfirmOptions): Promise<boolean>
  showInFolder(path: string): Promise<void>
  /** Sprache für Texte des Hauptprozesses (Dialoge, Fehlermeldungen) */
  setLanguage(language: Language): Promise<void>
}
