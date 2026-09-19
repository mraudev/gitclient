import { useEffect, useRef, useState } from 'react'
import type { Commit, RefLabel } from '../../../shared/types'
import type { GraphLayout, GraphRow } from '../lib/graph'
import { t } from '../i18n'
import { formatDate, shortHash } from '../lib/format'

const ROW = 26
const LANE = 14
const MAX_GRAPH_LANES = 20
const LANE_COLORS = ['#4aa3ff', '#e5a33a', '#56c271', '#d86ad8', '#e06464', '#3cc4c4', '#b4b44a', '#8f86ff']
const laneColor = (i: number) => LANE_COLORS[i % LANE_COLORS.length]

function GraphCell({ row, width, isHead, isMerge }: { row: GraphRow; width: number; isHead: boolean; isMerge: boolean }) {
  const x = (col: number) => col * LANE + LANE / 2
  const y = (v: number) => v * ROW
  return (
    <svg className="graph" width={width * LANE} height={ROW}>
      {row.lines.map((l, i) => {
        const d =
          l.x1 === l.x2
            ? `M${x(l.x1)} ${y(l.y1)} L${x(l.x2)} ${y(l.y2)}`
            : `M${x(l.x1)} ${y(l.y1)} C${x(l.x1)} ${y((l.y1 + l.y2) / 2)} ${x(l.x2)} ${y((l.y1 + l.y2) / 2)} ${x(l.x2)} ${y(l.y2)}`
        return <path key={i} d={d} stroke={laneColor(l.color)} strokeWidth={2} fill="none" />
      })}
      <circle
        cx={x(row.col)}
        cy={ROW / 2}
        r={isMerge ? 3.5 : 4.5}
        fill={isHead ? 'var(--bg)' : laneColor(row.color)}
        stroke={laneColor(row.color)}
        strokeWidth={isHead ? 2.5 : 0}
      />
    </svg>
  )
}

function RefBadge({ label }: { label: RefLabel }) {
  const text = label.kind === 'head' ? 'HEAD' : label.name
  return (
    <span className={`ref ref-${label.kind} ${label.current ? 'current' : ''}`} title={text}>
      {text}
    </span>
  )
}

interface Props {
  commits: Commit[]
  graph: GraphLayout
  selectedHash: string | null
  onSelect(hash: string): void
  onContextMenu(commit: Commit): void
  hasMore: boolean
  onLoadMore(): void
}

export function CommitList({ commits, graph, selectedHash, onSelect, onContextMenu, hasMore, onLoadMore }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const graphWidth = Math.min(Math.max(graph.width, 1), MAX_GRAPH_LANES)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Ausgewählten Commit sichtbar halten (Tastatur, Sprung aus der Sidebar)
  useEffect(() => {
    const el = scroller.current
    const index = commits.findIndex((c) => c.hash === selectedHash)
    if (!el || index === -1) return
    const top = index * ROW
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight
  }, [selectedHash, commits])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const index = commits.findIndex((c) => c.hash === selectedHash)
    const next = Math.min(Math.max(index + (e.key === 'ArrowDown' ? 1 : -1), 0), commits.length - 1)
    if (commits[next]) onSelect(commits[next].hash)
  }

  const first = Math.max(0, Math.floor(scrollTop / ROW) - 10)
  const last = Math.min(commits.length, Math.ceil((scrollTop + height) / ROW) + 10)

  return (
    <div className="commit-list">
      <div className="commit-header">
        <span className="col-subject">{t.history.description}</span>
        <span className="col-author">{t.history.author}</span>
        <span className="col-date">{t.history.date}</span>
        <span className="col-hash">{t.history.commit}</span>
      </div>
      <div className="commit-scroll" ref={scroller} tabIndex={0} onKeyDown={onKeyDown} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {commits.length === 0 && <div className="placeholder">{t.history.noCommits}</div>}
        <div style={{ height: commits.length * ROW + (hasMore ? 40 : 0), position: 'relative' }}>
          {commits.slice(first, last).map((c, i) => {
            const index = first + i
            const isHead = c.refs.some((r) => r.current || r.kind === 'head')
            return (
              <div
                key={c.hash}
                className={`commit-row ${c.hash === selectedHash ? 'selected' : ''}`}
                style={{ top: index * ROW, height: ROW }}
                onMouseDown={() => onSelect(c.hash)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onContextMenu(c)
                }}
              >
                <span className="col-subject">
                  <GraphCell row={graph.rows[index]} width={graphWidth} isHead={isHead} isMerge={c.parents.length > 1} />
                  {c.refs.map((r) => (
                    <RefBadge key={r.kind + r.name} label={r} />
                  ))}
                  <span className={`subject ${isHead ? 'head' : ''}`}>{c.subject}</span>
                </span>
                <span className="col-author" title={c.email}>
                  {c.author}
                </span>
                <span className="col-date">{formatDate(c.date)}</span>
                <span className="col-hash">{shortHash(c.hash)}</span>
              </div>
            )
          })}
          {hasMore && (
            <div className="load-more" style={{ top: commits.length * ROW }}>
              <button onClick={onLoadMore}>{t.history.loadMore}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
