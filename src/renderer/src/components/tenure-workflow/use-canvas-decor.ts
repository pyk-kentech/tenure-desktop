import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { OnNodesChange } from '@xyflow/react'
import { translate } from '@/i18n/i18n'
import type { WorkflowNode } from './workflow-model'
import type { Point } from './workflow-ties'
import { boxAround } from './workflow-decor'
import type { WorkflowDecorState } from './use-workflow-decor'
import { typing } from './WorkflowShortcuts'

/**
 * tenure: what the canvas does for ties, bends and groups when nodes move (DESIGN.md 36.39). Every
 * node move — a drag, or a group box carrying its nodes — reports how far each node went, so the
 * ties and bends on their lines can follow. Ctrl+G boxes the selected nodes.
 */
export function useCanvasDecor(opts: {
  nodes: WorkflowNode[]
  onNodesChange: OnNodesChange<WorkflowNode>
  onNodesMoved: (moved: Map<string, Point>) => void
  decor: WorkflowDecorState
  readOnly: boolean
  centre: () => Point
}) {
  const { nodes, onNodesChange: apply, onNodesMoved, readOnly, centre } = opts
  const { addGroup } = opts.decor
  // Why: several moves can arrive before React renders again; remember where each node went last
  // so a move is never counted twice.
  const pos = useRef(new Map<string, Point>())
  useLayoutEffect(() => {
    pos.current = new Map(nodes.map((n) => [n.id, n.position]))
  }, [nodes])

  const onNodesChange: OnNodesChange<WorkflowNode> = useCallback(
    (changes) => {
      const moved = new Map<string, Point>()
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          const prev = pos.current.get(c.id)
          if (prev && (prev.x !== c.position.x || prev.y !== c.position.y)) {
            moved.set(c.id, { x: c.position.x - prev.x, y: c.position.y - prev.y })
          }
          pos.current.set(c.id, c.position)
        }
      }
      if (moved.size) {
        onNodesMoved(moved)
      }
      apply(changes)
    },
    [apply, onNodesMoved]
  )

  const moveNodesTo = useCallback(
    (to: Map<string, Point>) =>
      onNodesChange([...to].map(([id, position]) => ({ type: 'position', id, position }))),
    [onNodesChange]
  )

  const latest = useRef(nodes)
  useLayoutEffect(() => {
    latest.current = nodes
  }, [nodes])
  useEffect(() => {
    if (readOnly) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyG' && !typing(e.target)) {
        e.preventDefault()
        const picked = latest.current.filter((n) => n.selected)
        addGroup(boxAround(picked, centre(), translate('tenure.workflow.group.untitled', 'Group')))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly, addGroup, centre])

  return { onNodesChange, moveNodesTo }
}
