import { createContext, useContext } from 'react'
import type { Stash } from '../../shared/types'

export type View = { kind: 'changes' } | { kind: 'history' } | { kind: 'stash'; stash: Stash }

export interface RepoCtx {
  repo: string
  /** Führt eine Git-Aktion mit Busy-Anzeige und Fehlermeldung aus und lädt danach neu. */
  run(label: string, fn: () => Promise<unknown>): Promise<void>
  /** Wählt einen Commit in der Historie aus. */
  jumpTo(hash: string): void
  openRepo(path: string): void
}

export const RepoContext = createContext<RepoCtx | null>(null)

export function useRepo(): RepoCtx {
  const ctx = useContext(RepoContext)
  if (!ctx) throw new Error('useRepo außerhalb von RepoContext')
  return ctx
}
