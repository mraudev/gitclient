import type { Language } from '../shared/types'

// Texte des Hauptprozesses; die Sprache setzt der Renderer beim Start und beim Umschalten.
// "&" markiert im Menü den Buchstaben für die Alt-Tastennavigation.
const de = {
  notARepo: (dir: string) => `"${dir}" ist kein Git-Repository.`,
  openRepoTitle: 'Repository öffnen',
  cancel: 'Abbrechen',
  gitFailed: (command: string, code: number | null) => `git ${command} fehlgeschlagen (Exit-Code ${code})`,
  noBranch: 'Kein Branch ausgecheckt (detached HEAD).',
  noRemote: 'Es ist kein Remote konfiguriert.',
  menu: {
    file: '&Datei',
    openRepo: 'Repository öffnen…',
    recent: 'Zuletzt geöffnet',
    noRecent: '(keine)',
    closeRepo: 'Repository schließen',
    settings: 'Einstellungen…',
    quit: 'Beenden',
    edit: '&Bearbeiten',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    cut: 'Ausschneiden',
    copy: 'Kopieren',
    paste: 'Einfügen',
    selectAll: 'Alles auswählen',
    view: '&Ansicht',
    localChanges: 'Lokale Änderungen',
    allCommits: 'Alle Commits',
    refresh: 'Aktualisieren',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    resetZoom: 'Originalgröße',
    fullscreen: 'Vollbild',
    devTools: 'Entwicklertools',
    repository: '&Repository',
    fetch: 'Fetch',
    pull: 'Pull',
    push: 'Push',
    newBranch: 'Neuer Branch…',
    stash: 'Stash…',
    showInExplorer: 'Im Explorer anzeigen',
    help: '&Hilfe',
    projectPage: 'Projektseite auf GitHub',
    about: 'Über Git Client',
    aboutDetail: (version: string, electron: string, chrome: string, node: string) =>
      `Version ${version}\n\nElectron ${electron}\nChromium ${chrome}\nNode.js ${node}`
  }
}

const en: typeof de = {
  notARepo: (dir) => `"${dir}" is not a Git repository.`,
  openRepoTitle: 'Open repository',
  cancel: 'Cancel',
  gitFailed: (command, code) => `git ${command} failed (exit code ${code})`,
  noBranch: 'No branch checked out (detached HEAD).',
  noRemote: 'No remote is configured.',
  menu: {
    file: '&File',
    openRepo: 'Open repository…',
    recent: 'Open recent',
    noRecent: '(none)',
    closeRepo: 'Close repository',
    settings: 'Settings…',
    quit: 'Exit',
    edit: '&Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
    view: '&View',
    localChanges: 'Local changes',
    allCommits: 'All commits',
    refresh: 'Refresh',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetZoom: 'Actual size',
    fullscreen: 'Toggle full screen',
    devTools: 'Developer tools',
    repository: '&Repository',
    fetch: 'Fetch',
    pull: 'Pull',
    push: 'Push',
    newBranch: 'New branch…',
    stash: 'Stash…',
    showInExplorer: 'Show in Explorer',
    help: '&Help',
    projectPage: 'Project page on GitHub',
    about: 'About Git Client',
    aboutDetail: (version, electron, chrome, node) => `Version ${version}\n\nElectron ${electron}\nChromium ${chrome}\nNode.js ${node}`
  }
}

export let mt: typeof de = en

export function setMainLanguage(language: Language): void {
  mt = language === 'de' ? de : en
}
