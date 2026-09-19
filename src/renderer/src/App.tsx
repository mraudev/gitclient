import { useCallback, useEffect, useState } from 'react'
import type { RepoInfo } from '../../shared/types'
import { app } from './api'
import { DialogHost, notifyError, ToastHost } from './dialogs'
import { useLanguage } from './i18n'
import { RepoView } from './components/RepoView'
import { Welcome } from './components/Welcome'

const LAST_REPO_KEY = 'lastRepo'

export function App() {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [restoring, setRestoring] = useState(true)
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
  }, [repo])

  return (
    <>
      {/* Sprache im key: beim Umschalten wird die Ansicht mit den neuen Texten neu aufgebaut */}
      {!restoring &&
        (repo ? <RepoView key={`${language}:${repo.path}`} repo={repo} openRepo={open} /> : <Welcome key={language} onOpen={open} />)}
      <DialogHost />
      <ToastHost />
    </>
  )
}
