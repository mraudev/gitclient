import { app, git } from './api'
import { prompt, validateBranchName } from './dialogs'
import { t } from './i18n'
import { errorMessage } from './lib/format'
import type { FileChange, Stash } from '../../shared/types'

export async function createBranch(repo: string, startPoint: string, startLabel: string): Promise<void> {
  const r = await prompt({
    title: t.dialogs.newBranch,
    label: t.dialogs.nameWithStart(startLabel),
    placeholder: t.dialogs.branchPlaceholder,
    confirmLabel: t.dialogs.create,
    checkbox: { label: t.dialogs.checkoutAfterCreate, defaultChecked: true },
    validate: validateBranchName
  })
  if (r) await git.createBranch(repo, r.value, startPoint, r.checked)
}

export async function renameBranch(repo: string, name: string): Promise<void> {
  const r = await prompt({
    title: t.dialogs.renameBranch,
    label: t.dialogs.newName,
    defaultValue: name,
    confirmLabel: t.common.rename,
    validate: validateBranchName
  })
  if (r && r.value !== name) await git.renameBranch(repo, name, r.value)
}

export async function deleteBranch(repo: string, name: string): Promise<void> {
  const ok = await app.confirm({ message: t.dialogs.deleteBranch(name), confirmLabel: t.common.delete })
  if (!ok) return
  try {
    await git.deleteBranch(repo, name, false)
  } catch (e) {
    const force = await app.confirm({
      message: t.dialogs.deleteBranchFailed(name),
      detail: t.dialogs.deleteBranchForceDetail(errorMessage(e)),
      confirmLabel: t.dialogs.forceDelete
    })
    if (force) await git.deleteBranch(repo, name, true)
  }
}

export async function deleteRemoteBranch(repo: string, name: string, remote: string): Promise<void> {
  const ok = await app.confirm({
    message: t.dialogs.deleteRemoteBranch(name),
    detail: t.dialogs.deleteRemoteBranchDetail(remote),
    confirmLabel: t.dialogs.deleteOnRemote
  })
  if (ok) await git.deleteRemoteBranch(repo, name, remote)
}

export async function saveStash(repo: string): Promise<void> {
  const r = await prompt({
    title: t.dialogs.stashChanges,
    label: t.dialogs.messageOptional,
    confirmLabel: t.dialogs.stash,
    checkbox: { label: t.dialogs.includeUntracked, defaultChecked: true }
  })
  if (r) await git.stashSave(repo, r.value, r.checked)
}

export async function dropStash(repo: string, stash: Stash): Promise<void> {
  const ok = await app.confirm({ message: t.dialogs.dropStash(stash.message), confirmLabel: t.common.delete })
  if (ok) await git.stashDrop(repo, stash.ref)
}

export async function discardChanges(repo: string, files: FileChange[]): Promise<void> {
  const ok = await app.confirm({
    message: files.length === 1 ? t.dialogs.discardFile(files[0].path) : t.dialogs.discardFiles(files.length),
    detail: t.dialogs.cannotUndo,
    confirmLabel: t.common.discard
  })
  if (ok) await git.discard(repo, files)
}

/** Verwirft einen Teil der Änderungen einer Datei; `what` z. B. t.changes.thisHunk oder t.changes.lines(3). */
export async function discardPart(repo: string, path: string, patch: string, what: string): Promise<void> {
  const ok = await app.confirm({
    message: t.dialogs.discardPart(what, path),
    detail: t.dialogs.discardPartDetail,
    confirmLabel: t.common.discard
  })
  if (ok) await git.discardPatch(repo, patch)
}
