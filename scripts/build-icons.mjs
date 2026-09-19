// Erzeugt aus resources/icon.svg die App-Icons: resources/icon.png (512 px) und resources/icon.ico (Windows).
// Bis 32 px wird resources/icon-small.svg (kräftigere Linien) verwendet.
// Aufruf: npm run icons
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('resources/icon.svg')
const svgSmall = readFileSync('resources/icon-small.svg')
const render = (size) => new Resvg(size <= 32 ? svgSmall : svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

writeFileSync('resources/icon.png', render(512))

// ICO-Datei: 6-Byte-Header, je Größe ein 16-Byte-Verzeichniseintrag, danach die PNG-Daten
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = sizes.map(render)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserviert
header.writeUInt16LE(1, 2) // Typ: Icon
header.writeUInt16LE(pngs.length, 4)
let offset = 6 + 16 * pngs.length
const entries = pngs.map((png, i) => {
  const entry = Buffer.alloc(16)
  const size = sizes[i] >= 256 ? 0 : sizes[i] // 0 steht für 256
  entry.writeUInt8(size, 0) // Breite
  entry.writeUInt8(size, 1) // Höhe
  entry.writeUInt16LE(1, 4) // Farbebenen
  entry.writeUInt16LE(32, 6) // Bit pro Pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += png.length
  return entry
})
writeFileSync('resources/icon.ico', Buffer.concat([header, ...entries, ...pngs]))

console.log(`resources/icon.png (512 px) und resources/icon.ico (${sizes.join(', ')} px) erzeugt`)
