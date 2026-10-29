import { useCallback, useMemo, useState } from 'react'
import type { Edge } from '@xyflow/react'
import { followBends, liveBends, newDecorId, type Bend, type Group } from './workflow-decor'
import type { Point } from './workflow-ties'

/** tenure: bend points and group boxes of the editor (DESIGN.md 36.39). */
export function useWorkflowDecor(edges: Edge[]) {
  const [rawBends, setBends] = useState<Bend[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const bends = useMemo(() => liveBends(rawBends, edges), [rawBends, edges])

  const reset = useCallback((nextBends: Bend[], nextGroups: Group[]) => {
    setBends(nextBends)
    setGroups(nextGroups)
  }, [])

  const addBend = useCallback(
    (edge: string, at: Point) =>
      setBends((bs) => [...bs, { id: newDecorId('bend'), edge, x: at.x, y: at.y }]),
    []
  )
  const moveBend = useCallback(
    (id: string, at: Point) =>
      setBends((bs) => bs.map((b) => (b.id === id ? { ...b, x: at.x, y: at.y } : b))),
    []
  )
  const removeBend = useCallback(
    (id: string) => setBends((bs) => bs.filter((b) => b.id !== id)),
    []
  )

  const addGroup = useCallback((g: Group) => setGroups((gs) => [...gs, g]), [])
  const updateGroup = useCallback(
    (id: string, patch: Partial<Omit<Group, 'id'>>) =>
      setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g))),
    []
  )
  const removeGroup = useCallback(
    (id: string) => setGroups((gs) => gs.filter((g) => g.id !== id)),
    []
  )

  const follow = useCallback(
    (moved: Map<string, Point>) => setBends((bs) => followBends(bs, edges, moved)),
    [edges]
  )

  return {
    bends,
    groups,
    reset,
    addBend,
    moveBend,
    removeBend,
    addGroup,
    updateGroup,
    removeGroup,
    follow
  }
}

export type WorkflowDecorState = ReturnType<typeof useWorkflowDecor>
