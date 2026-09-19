import { useSyncExternalStore } from 'react'
import type { FileStatus, Language } from '../../shared/types'
import { app } from './api'

// Deutsch definiert die Struktur; Englisch muss dieselben Schlüssel haben (prüft der Typecheck).
// Texte mit Parametern sind Funktionen, damit Plural und Satzstellung je Sprache stimmen.
const de = {
  common: {
    cancel: 'Abbrechen',
    close: 'Schließen',
    delete: 'Löschen',
    deleteEllipsis: 'Löschen…',
    discard: 'Verwerfen',
    rename: 'Umbenennen',
    renameEllipsis: 'Umbenennen…',
    open: 'Öffnen',
    checkout: 'Auschecken',
    checkoutDetached: 'Auschecken (detached HEAD)',
    newBranchHere: 'Neuer Branch von hier…',
    showInExplorer: 'Im Explorer anzeigen',
    openRepoEllipsis: 'Repository öffnen…',
    hashCopied: 'Hash kopiert',
    language: 'Sprache',
    settings: 'Einstellungen'
  },
  buttons: {
    stage: 'Stagen',
    unstage: 'Unstagen',
    stageAll: 'Alle stagen',
    unstageAll: 'Alle unstagen',
    stageHunk: 'Hunk stagen',
    unstageHunk: 'Hunk unstagen',
    stageLines: 'Zeilen stagen',
    unstageLines: 'Zeilen unstagen'
  },
  // Anzeige während eine Aktion läuft ("…" wird angehängt)
  busy: {
    stage: 'Stagen',
    unstage: 'Unstagen',
    stageAll: 'Alle stagen',
    unstageAll: 'Alle unstagen',
    discard: 'Verwerfen',
    stageHunk: 'Hunk stagen',
    unstageHunk: 'Hunk unstagen',
    discardHunk: 'Hunk verwerfen',
    stageLines: 'Zeilen stagen',
    unstageLines: 'Zeilen unstagen',
    discardLines: 'Zeilen verwerfen',
    createBranch: 'Branch erstellen',
    rename: 'Umbenennen',
    delete: 'Löschen',
    deleteRemoteBranch: 'Remote-Branch löschen',
    applyStash: 'Stash anwenden',
    dropStash: 'Stash löschen'
  },
  status: {
    A: 'Hinzugefügt',
    M: 'Geändert',
    D: 'Gelöscht',
    R: 'Umbenannt',
    C: 'Kopiert',
    T: 'Typ geändert',
    U: 'Konflikt',
    '?': 'Neu (untracked)'
  } satisfies Record<FileStatus, string>,
  toolbar: {
    upstream: (u: string) => `Upstream: ${u}`,
    noUpstream: 'Kein Upstream',
    fetchTitle: 'Alle Remotes abrufen (fetch --all --prune)',
    branchTitle: 'Neuen Branch vom aktuellen Stand erstellen',
    stashTitle: 'Lokale Änderungen stashen',
    refresh: 'Aktualisieren (F5)'
  },
  welcome: {
    recent: 'Zuletzt geöffnet',
    removeFromList: 'Aus der Liste entfernen'
  },
  sidebar: {
    filter: 'Filtern…',
    localChanges: 'Lokale Änderungen',
    allCommits: 'Alle Commits',
    checkoutCreateLocal: 'Auschecken (lokalen Branch anlegen)',
    deleteOnRemote: (remote: string) => `Auf ${remote} löschen…`,
    apply: 'Anwenden',
    applyAndDrop: 'Anwenden und löschen (pop)',
    upstreamGone: 'Upstream existiert nicht mehr',
    track: (ahead: number, behind: number, upstream: string) => `${ahead} voraus, ${behind} zurück gegenüber ${upstream}`,
    mainWorktree: ' (Haupt-Worktree)',
    locked: ' – gesperrt',
    prunable: ' – verwaist',
    mainBadge: 'Haupt'
  },
  history: {
    description: 'Beschreibung',
    author: 'Autor',
    date: 'Datum',
    commit: 'Commit',
    noCommits: 'Noch keine Commits',
    loadMore: 'Weitere Commits laden',
    copyHash: 'Hash kopieren',
    loadingRepo: 'Lade Repository…',
    selectCommit: 'Commit auswählen',
    notLoaded: (hash: string) => `Commit ${hash} ist nicht in den geladenen Commits enthalten.`
  },
  details: {
    loading: 'Lade Commit…',
    author: 'Autor',
    committer: 'Committer',
    commit: 'Commit',
    parents: 'Eltern',
    copyFullHash: 'Vollständigen Hash kopieren',
    changedFiles: (n: number) => (n === 1 ? '1 geänderte Datei' : `${n} geänderte Dateien`),
    loadingDiff: 'Lade Diff…',
    noFiles: 'Keine Dateien geändert'
  },
  changes: {
    unstaged: (n: number) => `Nicht gestaged (${n})`,
    staged: (n: number) => `Gestaged (${n})`,
    stagedSuffix: ' (gestaged)',
    conflicts: (n: number) => (n === 1 ? '1 Konflikt' : `${n} Konflikte`),
    markResolved: 'Als gelöst markieren (stagen)',
    discardChangesEllipsis: 'Änderungen verwerfen…',
    commitPlaceholder: 'Commit-Nachricht (Strg+Enter zum Committen)',
    amend: 'Letzten Commit ändern (amend)',
    selectFile: 'Datei auswählen, um die Änderungen zu sehen',
    noChanges: 'Keine lokalen Änderungen',
    changeNotFound: 'Änderung nicht gefunden – bitte neu laden.',
    lines: (n: number) => (n === 1 ? '1 Zeile' : `${n} Zeilen`),
    thisHunk: 'diesen Hunk'
  },
  diff: {
    linesSelected: (lines: string) => `${lines} ausgewählt`,
    selectHint: 'Zeilen anklicken oder ziehen, um sie einzeln auszuwählen',
    noTextChanges: 'Keine Textänderungen',
    moreLinesHidden: (n: number) => `… ${n} weitere Zeilen ausgeblendet`,
    renamedFrom: (path: string) => `Umbenannt von ${path}`,
    modeChanged: (mode: string) => `Dateimodus geändert: ${mode}`,
    binary: 'Binärdatei – keine Textvorschau',
    tooLarge: 'Datei zu groß für die Vorschau',
    noNewline: 'Kein Zeilenumbruch am Dateiende'
  },
  dialogs: {
    newBranch: 'Neuer Branch',
    nameWithStart: (start: string) => `Name (Startpunkt: ${start})`,
    branchPlaceholder: 'feature/mein-branch',
    create: 'Erstellen',
    checkoutAfterCreate: 'Nach dem Erstellen auschecken',
    renameBranch: 'Branch umbenennen',
    newName: 'Neuer Name',
    enterName: 'Bitte einen Namen eingeben.',
    invalidBranchName: 'Ungültiger Branch-Name.',
    deleteBranch: (name: string) => `Branch "${name}" löschen?`,
    deleteBranchFailed: (name: string) => `Branch "${name}" konnte nicht gelöscht werden.`,
    deleteBranchForceDetail: (error: string) => `${error}\n\nDabei können Commits verloren gehen, die in keinem anderen Branch enthalten sind.`,
    forceDelete: 'Löschen erzwingen',
    deleteRemoteBranch: (name: string) => `Remote-Branch "${name}" löschen?`,
    deleteRemoteBranchDetail: (remote: string) => `Der Branch wird auf "${remote}" gelöscht und ist danach für alle entfernt.`,
    deleteOnRemote: 'Auf Remote löschen',
    stashChanges: 'Änderungen stashen',
    messageOptional: 'Nachricht (optional)',
    stash: 'Stashen',
    includeUntracked: 'Untracked Dateien einschließen',
    dropStash: (message: string) => `Stash "${message}" löschen?`,
    discardFile: (path: string) => `Änderungen an "${path}" verwerfen?`,
    discardFiles: (n: number) => `Änderungen an ${n} Dateien verwerfen?`,
    cannotUndo: 'Das kann nicht rückgängig gemacht werden.',
    discardPart: (what: string, path: string) => `${what[0].toUpperCase()}${what.slice(1)} in "${path}" verwerfen?`,
    discardPartDetail: 'Die Änderung wird aus der Datei entfernt. Das kann nicht rückgängig gemacht werden.'
  }
}

export type Messages = typeof de

const en: Messages = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    deleteEllipsis: 'Delete…',
    discard: 'Discard',
    rename: 'Rename',
    renameEllipsis: 'Rename…',
    open: 'Open',
    checkout: 'Check out',
    checkoutDetached: 'Check out (detached HEAD)',
    newBranchHere: 'New branch from here…',
    showInExplorer: 'Show in Explorer',
    openRepoEllipsis: 'Open repository…',
    hashCopied: 'Hash copied',
    language: 'Language',
    settings: 'Settings'
  },
  buttons: {
    stage: 'Stage',
    unstage: 'Unstage',
    stageAll: 'Stage all',
    unstageAll: 'Unstage all',
    stageHunk: 'Stage hunk',
    unstageHunk: 'Unstage hunk',
    stageLines: 'Stage lines',
    unstageLines: 'Unstage lines'
  },
  busy: {
    stage: 'Staging',
    unstage: 'Unstaging',
    stageAll: 'Staging all',
    unstageAll: 'Unstaging all',
    discard: 'Discarding',
    stageHunk: 'Staging hunk',
    unstageHunk: 'Unstaging hunk',
    discardHunk: 'Discarding hunk',
    stageLines: 'Staging lines',
    unstageLines: 'Unstaging lines',
    discardLines: 'Discarding lines',
    createBranch: 'Creating branch',
    rename: 'Renaming',
    delete: 'Deleting',
    deleteRemoteBranch: 'Deleting remote branch',
    applyStash: 'Applying stash',
    dropStash: 'Dropping stash'
  },
  status: {
    A: 'Added',
    M: 'Modified',
    D: 'Deleted',
    R: 'Renamed',
    C: 'Copied',
    T: 'Type changed',
    U: 'Conflict',
    '?': 'New (untracked)'
  },
  toolbar: {
    upstream: (u) => `Upstream: ${u}`,
    noUpstream: 'No upstream',
    fetchTitle: 'Fetch all remotes (fetch --all --prune)',
    branchTitle: 'Create a new branch from the current state',
    stashTitle: 'Stash local changes',
    refresh: 'Refresh (F5)'
  },
  welcome: {
    recent: 'Recent',
    removeFromList: 'Remove from list'
  },
  sidebar: {
    filter: 'Filter…',
    localChanges: 'Local changes',
    allCommits: 'All commits',
    checkoutCreateLocal: 'Check out (create local branch)',
    deleteOnRemote: (remote) => `Delete on ${remote}…`,
    apply: 'Apply',
    applyAndDrop: 'Apply and drop (pop)',
    upstreamGone: 'Upstream no longer exists',
    track: (ahead, behind, upstream) => `${ahead} ahead, ${behind} behind ${upstream}`,
    mainWorktree: ' (main worktree)',
    locked: ' – locked',
    prunable: ' – prunable',
    mainBadge: 'primary'
  },
  history: {
    description: 'Description',
    author: 'Author',
    date: 'Date',
    commit: 'Commit',
    noCommits: 'No commits yet',
    loadMore: 'Load more commits',
    copyHash: 'Copy hash',
    loadingRepo: 'Loading repository…',
    selectCommit: 'Select a commit',
    notLoaded: (hash) => `Commit ${hash} is not among the loaded commits.`
  },
  details: {
    loading: 'Loading commit…',
    author: 'Author',
    committer: 'Committer',
    commit: 'Commit',
    parents: 'Parents',
    copyFullHash: 'Copy full hash',
    changedFiles: (n) => (n === 1 ? '1 changed file' : `${n} changed files`),
    loadingDiff: 'Loading diff…',
    noFiles: 'No files changed'
  },
  changes: {
    unstaged: (n) => `Unstaged (${n})`,
    staged: (n) => `Staged (${n})`,
    stagedSuffix: ' (staged)',
    conflicts: (n) => (n === 1 ? '1 conflict' : `${n} conflicts`),
    markResolved: 'Mark as resolved (stage)',
    discardChangesEllipsis: 'Discard changes…',
    commitPlaceholder: 'Commit message (Ctrl+Enter to commit)',
    amend: 'Amend last commit',
    selectFile: 'Select a file to see its changes',
    noChanges: 'No local changes',
    changeNotFound: 'Change not found – please refresh.',
    lines: (n) => (n === 1 ? '1 line' : `${n} lines`),
    thisHunk: 'this hunk'
  },
  diff: {
    linesSelected: (lines) => `${lines} selected`,
    selectHint: 'Click or drag lines to select them individually',
    noTextChanges: 'No text changes',
    moreLinesHidden: (n) => `… ${n} more lines hidden`,
    renamedFrom: (path) => `Renamed from ${path}`,
    modeChanged: (mode) => `File mode changed: ${mode}`,
    binary: 'Binary file – no text preview',
    tooLarge: 'File too large to preview',
    noNewline: 'No newline at end of file'
  },
  dialogs: {
    newBranch: 'New branch',
    nameWithStart: (start) => `Name (start point: ${start})`,
    branchPlaceholder: 'feature/my-branch',
    create: 'Create',
    checkoutAfterCreate: 'Check out after creating',
    renameBranch: 'Rename branch',
    newName: 'New name',
    enterName: 'Please enter a name.',
    invalidBranchName: 'Invalid branch name.',
    deleteBranch: (name) => `Delete branch "${name}"?`,
    deleteBranchFailed: (name) => `Branch "${name}" could not be deleted.`,
    deleteBranchForceDetail: (error) => `${error}\n\nCommits that are not contained in any other branch may be lost.`,
    forceDelete: 'Force delete',
    deleteRemoteBranch: (name) => `Delete remote branch "${name}"?`,
    deleteRemoteBranchDetail: (remote) => `The branch will be deleted on "${remote}" and removed for everyone.`,
    deleteOnRemote: 'Delete on remote',
    stashChanges: 'Stash changes',
    messageOptional: 'Message (optional)',
    stash: 'Stash',
    includeUntracked: 'Include untracked files',
    dropStash: (message) => `Delete stash "${message}"?`,
    discardFile: (path) => `Discard changes to "${path}"?`,
    discardFiles: (n) => `Discard changes to ${n} files?`,
    cannotUndo: 'This cannot be undone.',
    discardPart: (what, path) => `Discard ${what} in "${path}"?`,
    discardPartDetail: 'The change will be removed from the file. This cannot be undone.'
  }
}

// ---------- Aktive Sprache ----------

const STORAGE_KEY = 'language'
const DEFAULT_LANGUAGE: Language = 'en'
const messages: Record<Language, Messages> = { de, en }

function loadLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'de' || stored === 'en' ? stored : DEFAULT_LANGUAGE
}

let current = loadLanguage()
/** Texte der aktiven Sprache. Beim Sprachwechsel wird die Oberfläche neu aufgebaut (siehe App). */
export let t: Messages = messages[current]

const listeners = new Set<() => void>()

function apply(lang: Language) {
  document.documentElement.lang = lang
  void app.setLanguage(lang) // Texte des Hauptprozesses (Dialoge, Fehlermeldungen)
}
apply(current)

export function setLanguage(lang: Language) {
  if (lang === current) return
  current = lang
  t = messages[lang]
  localStorage.setItem(STORAGE_KEY, lang)
  apply(lang)
  listeners.forEach((l) => l())
}

export function useLanguage(): Language {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )
}

export const dateLocale = (): string => (current === 'de' ? 'de-DE' : 'en-US')

/** Menü zur Sprachauswahl (Zahnrad in Toolbar und Willkommensseite). */
export async function showLanguageMenu(): Promise<void> {
  const choice = await app.contextMenu([
    { label: t.common.language, enabled: false },
    { id: 'en', label: 'English', type: 'radio', checked: current === 'en' },
    { id: 'de', label: 'Deutsch', type: 'radio', checked: current === 'de' }
  ])
  if (choice === 'en' || choice === 'de') setLanguage(choice)
}
