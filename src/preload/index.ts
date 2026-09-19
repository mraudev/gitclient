import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bridge', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!/^(git|app):\w+$/.test(channel)) return Promise.reject(new Error(`Unbekannter Kanal: ${channel}`))
    return ipcRenderer.invoke(channel, ...args)
  }
})
