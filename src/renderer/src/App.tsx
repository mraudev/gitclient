import { useCallback, useEffect, useState } from 'react'
import type { RepoInfo } from '../../shared/types'
import { app, useMenuAction } from './api'
import { DialogHost, notifyError, ToastHost } from './dialogs'
import { useLanguage } from './i18n'
import { RepoView } from './components/RepoView'
import { SettingsDialog } from './components/SettingsDialog'
import { Welcome } from './components/Welcome'

const LAST_REPO_KEY = 'lastRepo'

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const language = useLanguage()

  const open = useCallback(async (path: string) => {
    try {
      const info = await app.openRepo(path)
      setRepo(info)
      localStorage.setItem(LAST_REPO_KEY, info.path)
    } catch (e) {
      notifyError(e)
    }
  }, [])

  // Zuletzt geöffnetes Repository wiederherstellen
  useEffect(() => {
    const last = localStorage.getItem(LAST_REPO_KEY)
    if (!last) return setRestoring(false)
    app
      .openRepo(last)
      .then(setRepo)
      .catch(() => localStorage.removeItem(LAST_REPO_KEY))
      .finally(() => setRestoring(false))
  }, [])

  useEffect(() => {
    document.title = repo ? `${repo.name} – Git Client` : 'Git Client'
    void app.setRepoOpen(repo !== null) // schaltet die Repo-Menüpunkte frei
  }, [repo])

  // Menüaktionen ohne Repo-Bezug; die übrigen behandelt RepoView
  useMenuAction(async (action, arg) => {
    if (action === 'settings') setSettingsOpen(true)
    if (action === 'open-recent' && arg) void open(arg)
    if (action === 'close-repo') {
      setRepo(null)
      localStorage.removeItem(LAST_REPO_KEY)
    }
    if (action === 'open-repo') {
      try {
        const info = await app.openRepoDialog()
        if (info) void open(info.path)
      } catch (e) {
        notifyError(e)
      }
    }
  })

  return (
    <>
      {/* Sprache im key: beim Umschalten wird die Ansicht mit den neuen Texten neu aufgebaut */}
      {!restoring &&
        (repo ? <RepoView key={`${language}:${repo.path}`} repo={repo} openRepo={open} /> : <Welcome key={language} onOpen={open} />)}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <DialogHost />
      <ToastHost />
    </>
  )
}
