import { useCallback, useMemo } from 'react'
import type { Edge } from '@xyflow/react'
import { useWorkflowTies } from './use-workflow-ties'
import { useWorkflowDecor } from './use-workflow-decor'
import type { Point } from './workflow-ties'
import type { EditSnapshot } from './use-edit-history'

export type EditorLayers = Pick<EditSnapshot, 'ties' | 'bends' | 'groups'>

/**
 * tenure: everything drawn on the canvas besides nodes and lines — ties (DESIGN.md 36.34), bends and
 * group boxes (36.39). They load, save and undo together, and follow nodes as they move.
 */
export function useEditorLayers(edges: Edge[]) {
  const ties = useWorkflowTies(edges)
  const decor = useWorkflowDecor(edges)
  const { reset: resetTies, follow: followTies } = ties
  const { reset: resetDecor, follow: followBends } = decor

  const resetLayers = useCallback(
    (l: EditorLayers) => {
      resetTies(l.ties)
      resetDecor(l.bends, l.groups)
    },
    [resetTies, resetDecor]
  )

  const onNodesMoved = useCallback(
    (moved: Map<string, Point>) => {
      followTies(moved)
      followBends(moved)
    },
    [followTies, followBends]
  )

  const layers: EditorLayers = useMemo(
    () => ({ ties: ties.ties, bends: decor.bends, groups: decor.groups }),
    [ties.ties, decor.bends, decor.groups]
  )

  return { ties, decor, resetLayers, onNodesMoved, layers }
}
