import { useEffect, useRef } from 'react'
import type { AppApi, GitApi } from '../../shared/api'
import type { MenuAction } from '../../shared/types'

declare global {
  interface Window {
    bridge: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      onMenu(callback: (action: MenuAction, arg?: string) => void): () => void
    }
  }
}

/** Reagiert auf Aktionen aus dem Hauptmenü; der Handler darf sich bei jedem Rendern ändern. */
export function useMenuAction(handler: (action: MenuAction, arg?: string) => void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => window.bridge.onMenu((action, arg) => ref.current(action, arg)), [])
}

/** Entfernt den Electron-Präfix "Error invoking remote method 'x': Error: ". */
function cleanError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  return new Error(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
}

function proxy<T extends object>(prefix: string): T {
  return new Proxy({} as T, {
    get:
      (_target, name) =>
      (...args: unknown[]) =>
        window.bridge.invoke(`${prefix}:${String(name)}`, ...args).catch((e) => {
          throw cleanError(e)
        })
  })
}

export const git = proxy<GitApi>('git')
export const app = proxy<AppApi>('app')
