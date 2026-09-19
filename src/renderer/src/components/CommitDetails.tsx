import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { CommitDetails as Details, FileChange } from '../../../shared/types'
import { git } from '../api'
import { notify, notifyError } from '../dialogs'
import { formatDate, shortHash } from '../lib/format'
import { useRepo } from '../repoContext'
import { DiffView } from './DiffView'
import { FileList } from './FileList'
import { Split } from './Split'

export function CommitDetails({ hash }: { hash: string }) {
  const { repo, jumpTo } = useRepo()
  const [details, setDetails] = useState<Details | null>(null)
  const [file, setFile] = useState<FileChange | null>(null)
  const [diff, setDiff] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    setDetails(null)
    setFile(null)
    git
      .commitDetails(repo, hash)
      .then((d) => {
        if (stale) return
        setDetails(d)
        setFile(d.files[0] ?? null)
      })
      .catch(notifyError)
    return () => {
      stale = true
    }
  }, [repo, hash])

  useEffect(() => {
    let stale = false
    setDiff(null)
    if (file)
      git
        .commitFileDiff(repo, hash, file)
        .then((d) => !stale && setDiff(d))
        .catch(notifyError)
    return () => {
      stale = true
    }
  }, [repo, hash, file])

  if (!details) return <div className="placeholder">Lade Commit…</div>

  const copyHash = () => {
    void navigator.clipboard.writeText(details.hash)
    notify('Hash kopiert')
  }

  return (
    <Split direction="row" initial={380} storageKey="details" min={220}>
      <div className="details-side">
        <div className="commit-info">
          <div className="commit-subject">{details.subject}</div>
          {details.body && <pre className="commit-body">{details.body}</pre>}
          <table className="meta">
            <tbody>
              <tr>
                <th>Autor</th>
                <td>
                  {details.author} &lt;{details.email}&gt;
                  <div className="dim">{formatDate(details.date)}</div>
                </td>
              </tr>
              {(details.committer !== details.author || details.committerDate !== details.date) && (
                <tr>
                  <th>Committer</th>
                  <td>
                    {details.committer}
                    <div className="dim">{formatDate(details.committerDate)}</div>
                  </td>
                </tr>
              )}
              <tr>
                <th>Commit</th>
                <td>
                  <span className="mono">{shortHash(details.hash)}</span>
                  <button className="icon inline" title="Vollständigen Hash kopieren" onClick={copyHash}>
                    <Copy size={12} />
                  </button>
                </td>
              </tr>
              {details.parents.length > 0 && (
                <tr>
                  <th>Eltern</th>
                  <td>
                    {details.parents.map((p) => (
                      <a key={p} className="mono link" onClick={() => jumpTo(p)}>
                        {shortHash(p)}{' '}
                      </a>
                    ))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="section-title">{details.files.length} geänderte Dateien</div>
        <FileList files={details.files} selectedPath={file?.path} onSelect={setFile} />
      </div>
      <DiffView diff={file ? diff : null} title={file?.path} emptyText={details.files.length ? 'Lade Diff…' : 'Keine Dateien geändert'} />
    </Split>
  )
}
