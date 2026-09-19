import type { AppApi, GitApi } from '../../shared/api'

declare global {
  interface Window {
    bridge: { invoke(channel: string, ...args: unknown[]): Promise<unknown> }
  }
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
