import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { crossedLines, cutTies, type Point } from './workflow-ties'
import type { WorkflowTiesState } from './use-workflow-ties'

/** A cut being dragged: flow points for the result, canvas points for drawing it. */
export type TieCut = {
  p: Point
  q: Point
  from: Point
  to: Point
  crossings: number[]
  overTie: boolean
}

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

/** Every drawn line as points in flow coordinates (edge paths are drawn in flow space). */
function sampleLines(root: HTMLElement): Map<string, Point[]> {
  const out = new Map<string, Point[]>()
  for (const g of root.querySelectorAll<SVGGElement>('.react-flow__edge[data-id]')) {
    const path = g.querySelector<SVGPathElement>('path.react-flow__edge-path')
    const id = g.dataset.id
    if (!path || !id) {
      continue
    }
    const len = path.getTotalLength()
    const n = Math.max(8, Math.ceil(len / 12))
    const pts: Point[] = []
    for (let i = 0; i <= n; i++) {
      const p = path.getPointAtLength((len * i) / n)
      pts.push({ x: p.x, y: p.y })
    }
    out.set(id, pts)
  }
  return out
}

/**
 * tenure: hold Z and drag across lines to tie them, or across a tie to undo it (DESIGN.md 36.34).
 * Z is read by its key position so it works whatever the keyboard language.
 */
export function useTieCut(
  wrap: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  ties: WorkflowTiesState
) {
  const { screenToFlowPosition } = useReactFlow()
  const [held, setHeld] = useState(false)
  const [cut, setCut] = useState<TieCut | null>(null)
  const lines = useRef<Map<string, Point[]>>(new Map())

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
        setHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ') {
        setHeld(false)
      }
    }
    const blur = () => setHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const local = (e: PointerEvent) => {
    const box = wrap.current?.getBoundingClientRect()
    return { x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) }
  }
  const flow = (e: PointerEvent) => screenToFlowPosition({ x: e.clientX, y: e.clientY })

  const armed = held && enabled
  const handlers = {
    onPointerDownCapture: (e: PointerEvent<HTMLDivElement>) => {
      if (!armed || e.button !== 0 || !wrap.current) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      wrap.current.setPointerCapture(e.pointerId)
      lines.current = sampleLines(wrap.current)
      const p = flow(e)
      const at = local(e)
      setCut({ p, q: p, from: at, to: at, crossings: [], overTie: false })
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!cut) {
        return
      }
      const q = flow(e)
      setCut({
        ...cut,
        q,
        to: local(e),
        crossings: crossedLines(cut.p, q, lines.current).map((c) => c.t),
        overTie: cutTies(cut.p, q, ties.ties).length > 0
      })
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      if (!cut) {
        return
      }
      ties.cut(cut.p, flow(e), lines.current)
      setCut(null)
    }
  }
  return { armed, cut, handlers }
}
