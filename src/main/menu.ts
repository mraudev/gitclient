import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import type { MenuAction, RepoInfo } from '../shared/types'
import { mt } from './i18n'

const PROJECT_URL = 'https://github.com/mraudev/gitclient'

interface MenuState {
  repoOpen: boolean
  recent: RepoInfo[]
}

/** Schickt eine Menüaktion an die Oberfläche des fokussierten Fensters. */
function send(action: MenuAction, arg?: string) {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu', action, arg)
}

function showAbout() {
  const win = BrowserWindow.getFocusedWindow()
  const opts: Electron.MessageBoxOptions = {
    type: 'info',
    title: mt.menu.about,
    message: 'Git Client',
    detail: mt.menu.aboutDetail(app.getVersion(), process.versions.electron, process.versions.chrome, process.versions.node),
    noLink: true
  }
  void (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts))
}

/** Baut das Hauptmenü neu (nach Sprachwechsel, Öffnen/Schließen eines Repos, geänderter Recent-Liste). */
export function updateAppMenu({ repoOpen, recent }: MenuState): void {
  const repo = { enabled: repoOpen }
  const m = mt.menu

  const template: MenuItemConstructorOptions[] = [
    {
      label: m.file,
      submenu: [
        { label: m.openRepo, accelerator: 'CmdOrCtrl+O', click: () => send('open-repo') },
        {
          label: m.recent,
          submenu: recent.length
            ? recent.map((r) => ({ label: `${r.name}  —  ${r.path}`, click: () => send('open-recent', r.path) }))
            : [{ label: m.noRecent, enabled: false }]
        },
        { label: m.closeRepo, accelerator: 'CmdOrCtrl+W', ...repo, click: () => send('close-repo') },
        { type: 'separator' },
        { label: m.settings, accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: m.quit, role: 'quit' }
      ]
    },
    {
      label: m.edit,
      submenu: [
        { label: m.undo, role: 'undo' },
        { label: m.redo, role: 'redo' },
        { type: 'separator' },
        { label: m.cut, role: 'cut' },
        { label: m.copy, role: 'copy' },
        { label: m.paste, role: 'paste' },
        { type: 'separator' },
        { label: m.selectAll, role: 'selectAll' }
      ]
    },
    {
      label: m.view,
      submenu: [
        { label: m.localChanges, accelerator: 'CmdOrCtrl+1', ...repo, click: () => send('view-changes') },
        { label: m.allCommits, accelerator: 'CmdOrCtrl+2', ...repo, click: () => send('view-history') },
        { type: 'separator' },
        { label: m.refresh, accelerator: 'F5', ...repo, click: () => send('refresh') },
        { type: 'separator' },
        { label: m.zoomIn, role: 'zoomIn' },
        { label: m.zoomOut, role: 'zoomOut' },
        { label: m.resetZoom, role: 'resetZoom' },
        { type: 'separator' },
        { label: m.fullscreen, role: 'togglefullscreen' },
        { label: m.devTools, role: 'toggleDevTools', accelerator: 'F12' }
      ]
    },
    {
      label: m.repository,
      submenu: [
        { label: m.fetch, accelerator: 'CmdOrCtrl+Shift+F', ...repo, click: () => send('fetch') },
        { label: m.pull, accelerator: 'CmdOrCtrl+Shift+L', ...repo, click: () => send('pull') },
        { label: m.push, accelerator: 'CmdOrCtrl+Shift+P', ...repo, click: () => send('push') },
        { type: 'separator' },
        { label: m.newBranch, accelerator: 'CmdOrCtrl+Shift+B', ...repo, click: () => send('new-branch') },
        { label: m.stash, accelerator: 'CmdOrCtrl+Shift+S', ...repo, click: () => send('stash') },
        { type: 'separator' },
        { label: m.showInExplorer, ...repo, click: () => send('show-in-explorer') }
      ]
    },
    {
      label: m.help,
      submenu: [
        { label: m.projectPage, click: () => void shell.openExternal(PROJECT_URL) },
        { type: 'separator' },
        { label: m.about, click: showAbout }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
