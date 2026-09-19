import { useRef, useState, type ReactNode } from 'react'

interface Props {
  /** "row": nebeneinander, "column": übereinander */
  direction: 'row' | 'column'
  /** Startgröße des ersten Bereichs in px */
  initial: number
  min?: number
  storageKey: string
  children: [ReactNode, ReactNode]
}

function loadSize(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(`split:${key}`))
  return v > 0 ? v : fallback
}

export function Split({ direction, initial, min = 120, storageKey, children }: Props) {
  const [size, setSize] = useState(() => loadSize(storageKey, initial))
  const container = useRef<HTMLDivElement>(null)
  const horizontal = direction === 'row'

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const start = horizontal ? e.clientX : e.clientY
    const startSize = size
    const total = container.current ? (horizontal ? container.current.clientWidth : container.current.clientHeight) : Infinity
    let latest = startSize
    const onMove = (ev: MouseEvent) => {
      const delta = (horizontal ? ev.clientX : ev.clientY) - start
      latest = Math.min(Math.max(startSize + delta, min), total - min)
      setSize(latest)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('resizing', 'resizing-y')
      localStorage.setItem(`split:${storageKey}`, String(Math.round(latest)))
    }
    document.body.classList.add('resizing', ...(horizontal ? [] : ['resizing-y']))
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div ref={container} className={`split split-${direction}`}>
      <div className="split-pane" style={{ flexBasis: size }}>
        {children[0]}
      </div>
      <div className="splitter" onMouseDown={startDrag} />
      <div className="split-pane split-rest">{children[1]}</div>
    </div>
  )
}
