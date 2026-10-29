import { useCallback, useMemo, useState } from 'react'
import type { Edge } from '@xyflow/react'
import { crossedLines, cutTies, liveTies, tieFromCut, type Point, type Tie } from './workflow-ties'

/**
 * tenure: cable ties of the editor (DESIGN.md 36.34). Ties keep line ids; a line that is removed or
 * moved leaves its tie, and a tie with no line left disappears.
 */
export function useWorkflowTies(edges: Edge[]) {
  const [raw, setRaw] = useState<Tie[]>([])
  const ties = useMemo(() => liveTies(raw, edges), [raw, edges])

  const reset = useCallback((next: Tie[]) => setRaw(next), [])

  // A cut across ties undoes them; otherwise the lines it crossed get a new tie there.
  const cut = useCallback(
    (p: Point, q: Point, lines: Map<string, Point[]>) => {
      const hit = new Set(cutTies(p, q, ties).map((t) => t.id))
      if (hit.size > 0) {
        setRaw((ts) => ts.filter((t) => !hit.has(t.id)))
        return
      }
      const tie = tieFromCut(p, q, crossedLines(p, q, lines))
      if (tie) {
        setRaw((ts) => [...liveTies(ts, edges), tie])
      }
    },
    [ties, edges]
  )

  const update = useCallback(
    (id: string, patch: Partial<Pick<Tie, 'x' | 'y' | 'angle'>>) =>
      setRaw((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    []
  )

  const remove = useCallback((id: string) => setRaw((ts) => ts.filter((t) => t.id !== id)), [])

  return { ties, reset, cut, update, remove }
}

export type WorkflowTiesState = ReturnType<typeof useWorkflowTies>
