import type { Commit } from '../../../shared/types'

/** Ein Liniensegment innerhalb einer Zeile; x in Spalten, y in Zeilenhöhen (0 = oben, 0.5 = Mitte, 1 = unten). */
export interface GraphLine {
  x1: number
  y1: number
  x2: number
  y2: number
  color: number
}

export interface GraphRow {
  col: number
  color: number
  lines: GraphLine[]
}

export interface GraphLayout {
  rows: GraphRow[]
  width: number
}

/**
 * Weist jedem Commit eine Spalte ("Lane") zu. Jede Lane merkt sich den Hash, den sie als nächstes erwartet.
 * Lanes werden nicht verdichtet, damit durchlaufende Linien senkrecht bleiben; frei gewordene Lanes werden wiederverwendet.
 */
export function computeGraph(commits: Commit[]): GraphLayout {
  const lanes: (string | null)[] = []
  const colors: number[] = []
  let nextColor = 0
  let width = 0

  const freeLane = () => {
    const i = lanes.indexOf(null)
    return i === -1 ? lanes.length : i
  }

  const rows = commits.map((commit) => {
    let col = lanes.indexOf(commit.hash)
    const hasIncoming = col !== -1
    if (!hasIncoming) {
      col = freeLane()
      lanes[col] = commit.hash
      colors[col] = nextColor++
    }
    const before = lanes.slice()
    const colorsBefore = colors.slice()
    const nodeColor = colors[col]
    const lines: GraphLine[] = []

    before.forEach((hash, i) => {
      if (hash === commit.hash) {
        if (i !== col || hasIncoming) lines.push({ x1: i, y1: 0, x2: col, y2: 0.5, color: colorsBefore[i] })
        lanes[i] = null
      }
    })

    commit.parents.forEach((parent, pi) => {
      let k = lanes.indexOf(parent)
      if (k === -1) {
        k = pi === 0 ? col : freeLane()
        lanes[k] = parent
        colors[k] = pi === 0 ? nodeColor : nextColor++
      }
      lines.push({ x1: col, y1: 0.5, x2: k, y2: 1, color: colors[k] })
    })

    before.forEach((hash, i) => {
      if (hash && hash !== commit.hash) lines.push({ x1: i, y1: 0, x2: i, y2: 1, color: colorsBefore[i] })
    })

    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop()
    width = Math.max(width, before.length, lanes.length)
    return { col, color: nodeColor, lines }
  })

  return { rows, width }
}
