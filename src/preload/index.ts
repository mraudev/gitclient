import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('bridge', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!/^(git|app):\w+$/.test(channel)) return Promise.reject(new Error(`Unbekannter Kanal: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  },
  /** Aktionen aus dem Hauptmenü; gibt eine Abmeldefunktion zurück. */
  onMenu(callback: (action: string, arg?: string) => void): () => void {
    const listener = (_e: IpcRendererEvent, action: string, arg?: string) => callback(action, arg)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  }
})
