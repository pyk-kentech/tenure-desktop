import React from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

// tenure: edges of the workflow editor (DESIGN.md 36.30, 36.32). Run-order and loop lines carry a
// small light that travels in the run direction; role lines take the agent's colour.

export type FlowEdgeData = {
  color?: string
  pulse?: 'normal' | 'fast' | 'none'
  dim?: boolean
}

const LOOP_DROP = 90
const LOOP_REACH = 24
const FLOW_COLOR = '#a1a1aa'

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

function Pulse({ path, color, seconds }: { path: string; color: string; seconds: number }) {
  return (
    <circle r={3.5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
      <animateMotion dur={`${seconds}s`} repeatCount="indefinite" path={path} />
    </circle>
  )
}

function pulseSeconds(dx: number, dy: number, mode: FlowEdgeData['pulse']): number {
  const base = Math.min(4, Math.max(1.2, Math.hypot(dx, dy) / 140))
  return mode === 'fast' ? base / 2.5 : base
}

function edgeLook(data: FlowEdgeData | undefined, fallback: string, width: number) {
  const color = data?.color ?? fallback
  return { color, style: { stroke: color, strokeWidth: width, opacity: data?.dim ? 0.3 : 1 } }
}

/** A run-order line (next / yes / no / fork): a curve with a light travelling forward. */
export function WorkflowFlowEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const [path] = getBezierPath(props)
  const { color, style } = edgeLook(data, FLOW_COLOR, 2.5)
  const pulse = data?.pulse ?? 'normal'
  return (
    <>
      <BaseEdge id={props.id} path={path} style={style} />
      {pulse !== 'none' && !data?.dim && !reducedMotion() ? (
        <Pulse
          path={path}
          color={color}
          seconds={pulseSeconds(
            props.targetX - props.sourceX,
            props.targetY - props.sourceY,
            pulse
          )}
        />
      ) : null}
    </>
  )
}

/**
 * A loop-back line: it leaves the step's right connector, drops below both steps and comes back into
 * the earlier step's left connector, so it never lies on top of the forward line.
 */
export function WorkflowLoopEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const { sourceX, sourceY, targetX, targetY } = props
  const low = Math.max(sourceY, targetY) + LOOP_DROP
  const r = LOOP_REACH
  const path = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + r * 2} ${sourceY}, ${sourceX + r * 2} ${low}, ${sourceX - r} ${low}`,
    `L ${targetX + r} ${low}`,
    `C ${targetX - r * 2} ${low}, ${targetX - r * 2} ${targetY}, ${targetX} ${targetY}`
  ].join(' ')
  const { color, style } = edgeLook(data, '#f59e0b', 2)
  const pulse = data?.pulse ?? 'normal'
  return (
    <>
      <BaseEdge id={props.id} path={path} style={{ ...style, strokeDasharray: '6 4' }} />
      {pulse !== 'none' && !data?.dim && !reducedMotion() ? (
        <Pulse
          path={path}
          color={color}
          seconds={pulseSeconds(sourceX - targetX, LOOP_DROP * 2, pulse) * 1.5}
        />
      ) : null}
    </>
  )
}

/** A role → slot line in the agent's colour. */
export function WorkflowRoleEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const [path] = getBezierPath(props)
  const { style } = edgeLook(data, '#71717a', 2)
  return <BaseEdge id={props.id} path={path} style={style} />
}

export const WORKFLOW_EDGE_TYPES = {
  tenureFlow: WorkflowFlowEdge,
  tenureLoop: WorkflowLoopEdge,
  tenureRole: WorkflowRoleEdge
}
