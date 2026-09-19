import type { Language } from '../shared/types'

// Texte des Hauptprozesses; die Sprache setzt der Renderer beim Start und beim Umschalten.
const de = {
  notARepo: (dir: string) => `"${dir}" ist kein Git-Repository.`,
  openRepoTitle: 'Repository öffnen',
  cancel: 'Abbrechen',
  gitFailed: (command: string, code: number | null) => `git ${command} fehlgeschlagen (Exit-Code ${code})`,
  noBranch: 'Kein Branch ausgecheckt (detached HEAD).',
  noRemote: 'Es ist kein Remote konfiguriert.'
}

const en: typeof de = {
  notARepo: (dir) => `"${dir}" is not a Git repository.`,
  openRepoTitle: 'Open repository',
  cancel: 'Cancel',
  gitFailed: (command, code) => `git ${command} failed (exit code ${code})`,
  noBranch: 'No branch checked out (detached HEAD).',
  noRemote: 'No remote is configured.'
}

export let mt: typeof de = en

export function setMainLanguage(language: Language): void {
  mt = language === 'de' ? de : en
}
