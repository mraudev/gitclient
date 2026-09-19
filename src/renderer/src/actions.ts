import { app, git } from './api'
import { prompt, validateBranchName } from './dialogs'
import { errorMessage } from './lib/format'
import type { FileChange, Stash } from '../../shared/types'

export async function createBranch(repo: string, startPoint: string, startLabel: string): Promise<void> {
  const r = await prompt({
    title: 'Neuer Branch',
    label: `Name (Startpunkt: ${startLabel})`,
    placeholder: 'feature/mein-branch',
    confirmLabel: 'Erstellen',
    checkbox: { label: 'Nach dem Erstellen auschecken', defaultChecked: true },
    validate: validateBranchName
  })
  if (r) await git.createBranch(repo, r.value, startPoint, r.checked)
}

export async function renameBranch(repo: string, name: string): Promise<void> {
  const r = await prompt({
    title: 'Branch umbenennen',
    label: 'Neuer Name',
    defaultValue: name,
    confirmLabel: 'Umbenennen',
    validate: validateBranchName
  })
  if (r && r.value !== name) await git.renameBranch(repo, name, r.value)
}

export async function deleteBranch(repo: string, name: string): Promise<void> {
  const ok = await app.confirm({ message: `Branch "${name}" löschen?`, confirmLabel: 'Löschen' })
  if (!ok) return
  try {
    await git.deleteBranch(repo, name, false)
  } catch (e) {
    const force = await app.confirm({
      message: `Branch "${name}" konnte nicht gelöscht werden.`,
      detail: `${errorMessage(e)}\n\nDabei können Commits verloren gehen, die in keinem anderen Branch enthalten sind.`,
      confirmLabel: 'Löschen erzwingen'
    })
    if (force) await git.deleteBranch(repo, name, true)
  }
}

export async function deleteRemoteBranch(repo: string, name: string, remote: string): Promise<void> {
  const ok = await app.confirm({
    message: `Remote-Branch "${name}" löschen?`,
    detail: `Der Branch wird auf "${remote}" gelöscht und ist danach für alle entfernt.`,
    confirmLabel: 'Auf Remote löschen'
  })
  if (ok) await git.deleteRemoteBranch(repo, name, remote)
}

export async function saveStash(repo: string): Promise<void> {
  const r = await prompt({
    title: 'Änderungen stashen',
    label: 'Nachricht (optional)',
    confirmLabel: 'Stashen',
    checkbox: { label: 'Untracked Dateien einschließen', defaultChecked: true }
  })
  if (r) await git.stashSave(repo, r.value, r.checked)
}

export async function dropStash(repo: string, stash: Stash): Promise<void> {
  const ok = await app.confirm({ message: `Stash "${stash.message}" löschen?`, confirmLabel: 'Löschen' })
  if (ok) await git.stashDrop(repo, stash.ref)
}

export async function discardChanges(repo: string, files: FileChange[]): Promise<void> {
  const ok = await app.confirm({
    message: files.length === 1 ? `Änderungen an "${files[0].path}" verwerfen?` : `Änderungen an ${files.length} Dateien verwerfen?`,
    detail: 'Das kann nicht rückgängig gemacht werden.',
    confirmLabel: 'Verwerfen'
  })
  if (ok) await git.discard(repo, files)
}

export async function discardHunk(repo: string, path: string, patch: string): Promise<void> {
  const ok = await app.confirm({
    message: `Diesen Hunk in "${path}" verwerfen?`,
    detail: 'Die Änderung wird aus der Datei entfernt. Das kann nicht rückgängig gemacht werden.',
    confirmLabel: 'Verwerfen'
  })
  if (ok) await git.discardPatch(repo, patch)
}
