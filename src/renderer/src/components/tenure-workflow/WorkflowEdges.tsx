import React from 'react'
import { BaseEdge, type EdgeProps } from '@xyflow/react'

const LOOP_DROP = 90
const LOOP_REACH = 24

/**
 * tenure: a loop-back line (DESIGN.md 36.30). It leaves the step's right dot, drops below both
 * steps and comes back into the earlier step's left dot, so it never lies on top of the forward line.
 */
export function WorkflowLoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style
}: EdgeProps): React.JSX.Element {
  const low = Math.max(sourceY, targetY) + LOOP_DROP
  const r = LOOP_REACH
  const path = [
    `M ${sourceX} ${sourceY}`,
    `H ${sourceX + r}`,
    `V ${low}`,
    `H ${targetX - r}`,
    `V ${targetY}`,
    `H ${targetX}`
  ].join(' ')
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
}

export const WORKFLOW_EDGE_TYPES = { tenureLoop: WorkflowLoopEdge }
