# Git Client

Git-Client im Stil von Fork – Electron + React + TypeScript, spricht über die installierte `git`-CLI.

## Start

```bash
npm install
npm run dev        # Entwicklung mit Hot Reload (F12 = DevTools)
npm run build      # Produktions-Build nach out/
npm run typecheck
npm run icons      # App-Icons aus resources/icon.svg neu erzeugen
```

Das App-Icon liegt als SVG in `resources/icon.svg`, dazu `resources/icon-small.svg` mit kräftigeren Linien für 16–32 px.
`npm run icons` erzeugt daraus `resources/icon.png` (512 px) und `resources/icon.ico` (Windows, 16–256 px).
Die erzeugten Dateien sind eingecheckt und müssen nur nach Änderungen am SVG neu gebaut werden.

Falls `npm run dev` mit „Electron uninstall“ abbricht, wurde das Electron-Binary nicht geladen:
`node node_modules/electron/install.js`

## Aufbau

```
resources/     App-Icon (SVG-Quellen + erzeugte PNG/ICO)
scripts/       Hilfsskripte (build-icons.mjs)
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

Dateityp-Icons stammen aus dem [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT-Lizenz, © 2025 Material Extensions). Die Zuordnung steckt in `src/renderer/src/lib/fileIcons.ts`; beim Build werden nur die Datei-Icons (ohne Ordner-Icons) als SVG-Dateien übernommen.

Sprachen: Englisch (Standard) und Deutsch, umschaltbar über das Zahnrad in der Toolbar bzw. auf der Startseite.
Texte stehen in `src/renderer/src/i18n.ts` (Oberfläche) und `src/main/i18n.ts` (Dialoge/Fehler des Hauptprozesses).
Neue Texte zuerst im deutschen Wörterbuch anlegen – der Typecheck meldet dann, wo die englische Fassung fehlt.

Neue Git-Funktion: Signatur in `src/shared/api.ts` ergänzen → in `gitApi` (`src/main/git.ts`) implementieren → im Renderer über `git.<name>(repo, …)` aufrufen. Die IPC-Registrierung passiert automatisch.
