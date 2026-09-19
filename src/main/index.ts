import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppApi } from '../shared/api'
import type { RepoInfo } from '../shared/types'
import { gitApi, repoRoot } from './git'

const MAX_RECENT = 15
const recentFile = () => path.join(app.getPath('userData'), 'recent.json')

async function readRecent(): Promise<RepoInfo[]> {
  try {
    return JSON.parse(await fs.readFile(recentFile(), 'utf8')) as RepoInfo[]
  } catch {
    return []
  }
}

async function writeRecent(list: RepoInfo[]): Promise<void> {
  await fs.writeFile(recentFile(), JSON.stringify(list, null, 2))
}

async function openRepo(dir: string): Promise<RepoInfo> {
  let root: string
  try {
    root = await repoRoot(dir)
  } catch {
    throw new Error(`"${dir}" ist kein Git-Repository.`)
  }
  const info: RepoInfo = { path: root, name: path.basename(root) }
  const recent = (await readRecent()).filter((r) => r.path.toLowerCase() !== root.toLowerCase())
  await writeRecent([info, ...recent].slice(0, MAX_RECENT))
  return info
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1f22',
    title: 'Git Client',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
  })
  // Links nie im App-Fenster öffnen
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}

function registerIpc(): void {
  for (const [name, fn] of Object.entries(gitApi)) {
    ipcMain.handle(`git:${name}`, (_e, ...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args))
  }

  const appApi: AppApi = {
    async openRepoDialog() {
      const win = BrowserWindow.getFocusedWindow()
      const opts: Electron.OpenDialogOptions = { title: 'Repository öffnen', properties: ['openDirectory'] }
      const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (res.canceled || res.filePaths.length === 0) return null
      return openRepo(res.filePaths[0])
    },
    openRepo,
    recentRepos: readRecent,
    async removeRecent(p) {
      await writeRecent((await readRecent()).filter((r) => r.path !== p))
    },
    contextMenu(items) {
      return new Promise((resolve) => {
        const menu = Menu.buildFromTemplate(
          items.map((item) =>
            item.type === 'separator'
              ? { type: 'separator' }
              : { label: item.label, enabled: item.enabled ?? true, click: () => resolve(item.id ?? null) }
          )
        )
        // "click" feuert vor dem Schließen; das verzögerte null greift nur ohne Auswahl
        menu.popup({ callback: () => setTimeout(() => resolve(null), 50) })
      })
    },
    async confirm({ message, detail, confirmLabel }) {
      const opts: Electron.MessageBoxOptions = {
        type: 'warning',
        message,
        detail,
        buttons: [confirmLabel, 'Abbrechen'],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      }
      const win = BrowserWindow.getFocusedWindow()
      const res = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts)
      return res.response === 0
    },
    async showInFolder(p) {
      shell.showItemInFolder(p)
    }
  }

  for (const [name, fn] of Object.entries(appApi)) {
    ipcMain.handle(`app:${name}`, (_e, ...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
