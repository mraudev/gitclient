import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import type { CommitDetails as Details, FileChange } from '../../../shared/types'
import { git } from '../api'
import { notify, notifyError } from '../dialogs'
import { t } from '../i18n'
import { Avatar } from './Avatar'
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

  if (!details) return <div className="placeholder">{t.details.loading}</div>

  const copyHash = () => {
    void navigator.clipboard.writeText(details.hash)
    notify(t.common.hashCopied)
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
                <th>{t.details.author}</th>
                <td>
                  <div className="person">
                    <Avatar name={details.author} email={details.email} size={28} />
                    <div>
                      {details.author} &lt;{details.email}&gt;
                      <div className="dim">{formatDate(details.date)}</div>
                    </div>
                  </div>
                </td>
              </tr>
              {(details.committer !== details.author || details.committerDate !== details.date) && (
                <tr>
                  <th>{t.details.committer}</th>
                  <td>
                    <div className="person">
                      <Avatar name={details.committer} email={details.committerEmail} size={28} />
                      <div>
                        {details.committer}
                        <div className="dim">{formatDate(details.committerDate)}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              <tr>
                <th>{t.details.commit}</th>
                <td>
                  <span className="mono">{shortHash(details.hash)}</span>
                  <button className="icon inline" title={t.details.copyFullHash} onClick={copyHash}>
                    <Copy size={12} />
                  </button>
                </td>
              </tr>
              {details.parents.length > 0 && (
                <tr>
                  <th>{t.details.parents}</th>
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
        <div className="section-title">{t.details.changedFiles(details.files.length)}</div>
        <FileList files={details.files} selectedPath={file?.path} onSelect={setFile} />
      </div>
      <DiffView diff={file ? diff : null} title={file?.path} emptyText={details.files.length ? t.details.loadingDiff : t.details.noFiles} />
    </Split>
  )
}
