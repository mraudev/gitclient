# Git Client

Git-Client im Stil von Fork – Electron + React + TypeScript, spricht über die installierte `git`-CLI.

## Start

```bash
npm install
npm run dev        # Entwicklung mit Hot Reload (F12 = DevTools)
npm run build      # Produktions-Build nach out/
npm run typecheck
```

Falls `npm run dev` mit „Electron uninstall“ abbricht, wurde das Electron-Binary nicht geladen:
`node node_modules/electron/install.js`

## Aufbau

```
src/
  shared/      Typen + API-Vertrag (GitApi, AppApi) zwischen Main und Renderer
  main/        Electron-Hauptprozess
    git.ts     Git-Service: ruft git per child_process auf und parst die Ausgabe
    index.ts   Fenster, IPC-Registrierung (git:*, app:*), Dialoge, Kontextmenüs, Recent-Liste
  preload/     Schmale Bridge: nur invoke() für git:/app:-Kanäle (contextIsolation + sandbox)
  renderer/    React-UI
    src/api.ts          Typisierter Proxy auf die IPC-Kanäle
    src/actions.ts      Aktionen mit Rückfrage (Branch anlegen/löschen, Stash, Verwerfen …)
    src/lib/graph.ts    Lane-Berechnung für den Commit-Graphen
    src/lib/diff.ts     Unified-Diff-Parser
    src/components/     Toolbar, Sidebar, CommitList, CommitDetails, ChangesView, DiffView …
```

Neue Git-Funktion: Signatur in `src/shared/api.ts` ergänzen → in `gitApi` (`src/main/git.ts`) implementieren → im Renderer über `git.<name>(repo, …)` aufrufen. Die IPC-Registrierung passiert automatisch.
