// Dateityp-Icons aus dem Material Icon Theme (MIT, https://github.com/material-extensions/vscode-material-icon-theme).
// Zuordnung wie in VS Code: exakter Dateiname vor Endung, längste Endung zuerst ("test.ts" vor "ts").
import { fileExtensions, fileNames, iconDefinitions, light } from 'material-icon-theme/dist/material-icons.json'

// Ordner-Icons werden nicht gebraucht; "no-inline" legt die SVGs als eigene Dateien ab statt im JS-Bundle
const iconFiles = import.meta.glob(
  ['../../../../node_modules/material-icon-theme/icons/*.svg', '!../../../../node_modules/material-icon-theme/icons/folder*.svg'],
  { query: '?no-inline', import: 'default', eager: true }
) as Record<string, string>

const urlByFile = new Map(Object.entries(iconFiles).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]))

type IconMap = Record<string, string>
const lower = (map: IconMap) => new Map(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]))
const dark = { names: lower(fileNames as IconMap), exts: lower(fileExtensions as IconMap) }
const bright = { names: lower(light.fileNames as IconMap), exts: lower(light.fileExtensions as IconMap) }

function iconName(fileName: string, lightTheme: boolean): string {
  const base = fileName.toLowerCase()
  const maps = lightTheme ? [bright, dark] : [dark]
  for (const m of maps) {
    const byName = m.names.get(base)
    if (byName) return byName
  }
  for (let i = base.indexOf('.'); i !== -1; i = base.indexOf('.', i + 1)) {
    const ext = base.slice(i + 1)
    for (const m of maps) {
      const byExt = m.exts.get(ext)
      if (byExt) return byExt
    }
  }
  return 'file'
}

function iconUrl(name: string): string | undefined {
  const def = (iconDefinitions as Record<string, { iconPath: string }>)[name]
  return def && urlByFile.get(def.iconPath.slice(def.iconPath.lastIndexOf('/') + 1))
}

const cache = new Map<string, string | undefined>()

/** URL des Icons für einen Dateipfad (z. B. "src/App.tsx"), passend zum hellen/dunklen Farbschema. */
export function fileIconUrl(path: string): string | undefined {
  const lightTheme = window.matchMedia('(prefers-color-scheme: light)').matches
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  const key = `${lightTheme ? 'l' : 'd'}:${fileName}`
  if (!cache.has(key)) cache.set(key, iconUrl(iconName(fileName, lightTheme)) ?? iconUrl('file'))
  return cache.get(key)
}
