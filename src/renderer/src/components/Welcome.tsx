import { useEffect, useState } from 'react'
import { FolderGit2, FolderOpen, X } from 'lucide-react'
import type { RepoInfo } from '../../../shared/types'
import { app } from '../api'
import { notifyError } from '../dialogs'

export function Welcome({ onOpen }: { onOpen(path: string): void }) {
  const [recent, setRecent] = useState<RepoInfo[]>([])

  useEffect(() => {
    app.recentRepos().then(setRecent).catch(notifyError)
  }, [])

  const openDialog = async () => {
    try {
      const info = await app.openRepoDialog()
      if (info) onOpen(info.path)
    } catch (e) {
      notifyError(e)
    }
  }

  const remove = async (path: string) => {
    await app.removeRecent(path)
    setRecent(await app.recentRepos())
  }

  return (
    <div className="welcome">
      <div className="welcome-card">
        <h1>Git Client</h1>
        <button className="primary big" onClick={openDialog}>
          <FolderOpen size={18} /> Repository öffnen…
        </button>
        {recent.length > 0 && (
          <>
            <div className="section-title">Zuletzt geöffnet</div>
            <div className="recent-list">
              {recent.map((r) => (
                <div key={r.path} className="recent-row" onClick={() => onOpen(r.path)}>
                  <FolderGit2 size={16} />
                  <div>
                    <div className="recent-name">{r.name}</div>
                    <div className="dim">{r.path}</div>
                  </div>
                  <button
                    className="icon row-action"
                    title="Aus der Liste entfernen"
                    onClick={(e) => {
                      e.stopPropagation()
                      void remove(r.path)
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
