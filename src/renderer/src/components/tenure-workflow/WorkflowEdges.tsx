import React, { useMemo } from 'react'
import {
  BaseEdge,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps
} from '@xyflow/react'
import { translate } from '@/i18n/i18n'
import { HANDLE_SIZE } from './workflow-node-rows'
import { viaPath, type Via } from './workflow-ties'

// tenure: edges of the workflow editor (DESIGN.md 36.30, 36.32). Every line starts and ends at the
// centre of its connector; run-order and loop lines carry a bright streak moving in the run direction.

export type WireStyle = 'bezier' | 'straight' | 'step'

export type FlowEdgeData = {
  wire?: WireStyle
  color?: string
  pulse?: 'normal' | 'fast' | 'none'
  dim?: boolean
  // Editor only: hovering the line shows a remove button at its middle.
  editable?: boolean
  // Strands of the cable ties this line passes (DESIGN.md 36.34).
  vias?: Via[]
}

const LOOP_DROP = 90
const LOOP_REACH = 24
const FLOW_COLOR = '#a1a1aa'
// Why: a line carrying a streak is drawn fainter, so the streak in the line's own colour reads as
// that stretch lighting up (user asked for the same colour as the line).
const CARRIER_OPACITY = 0.45
const R = HANDLE_SIZE / 2

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/** React Flow attaches lines to a connector's outer edge; move both ends onto the centres. */
function centred(p: EdgeProps) {
  const shift = (pos: Position) => (pos === Position.Right ? -R : pos === Position.Left ? R : 0)
  return {
    sourceX: p.sourceX + shift(p.sourcePosition),
    sourceY: p.sourceY,
    targetX: p.targetX + shift(p.targetPosition),
    targetY: p.targetY,
    sourcePosition: p.sourcePosition,
    targetPosition: p.targetPosition
  }
}

/** The line shape the user picked in the toolbar (DESIGN.md 36.33); a tied line goes through its ties. */
function wirePath(c: ReturnType<typeof centred>, data: FlowEdgeData | undefined): string {
  const wire = data?.wire
  if (data?.vias?.length) {
    return viaPath({ x: c.sourceX, y: c.sourceY }, { x: c.targetX, y: c.targetY }, data.vias)
  }
  if (wire === 'straight') {
    return getStraightPath(c)[0]
  }
  if (wire === 'step') {
    return getSmoothStepPath({ ...c, borderRadius: 8 })[0]
  }
  return getBezierPath(c)[0]
}

// How far before the connector a line enters its remove button sits, along the line.
const REMOVE_BEFORE_END = 28

/** A point on `path` just before its end (the middle of a line shorter than twice that). */
function nearEnd(path: string): { x: number; y: number } {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', path)
  const len = el.getTotalLength()
  const p = el.getPointAtLength(Math.max(len / 2, len - REMOVE_BEFORE_END))
  return { x: p.x, y: p.y }
}

/**
 * A remove button shown while the line is hovered or selected (DESIGN.md 36.33). It sits on the line
 * right before the connector the line enters, so it is clear which line it removes even where
 * lines cross (user found a button at the middle appeared at random spots). Hidden, it ignores the
 * pointer so clicking a line still only selects it.
 */
function RemoveButton(props: { id: string; path: string; selected?: boolean }) {
  const { deleteElements } = useReactFlow()
  const at = useMemo(() => nearEnd(props.path), [props.path])
  const shown = props.selected
    ? 'opacity-100'
    : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      className={`cursor-pointer transition-opacity ${shown}`}
      onClick={(e) => {
        e.stopPropagation()
        void deleteElements({ edges: [{ id: props.id }] })
      }}
    >
      <title>{translate('tenure.workflow.edge.remove', 'Remove line')}</title>
      <circle r={9} className="fill-card stroke-border" strokeWidth={1.5} />
      <path
        d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
        className="stroke-muted-foreground"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </g>
  )
}

/** A short bright streak travelling along the path (pathLength normalises any path to 100). */
function Streak({ path, color, seconds }: { path: string; color: string; seconds: number }) {
  return (
    <path
      d={path}
      fill="none"
      pathLength={100}
      stroke={color}
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeDasharray="7 93"
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    >
      <animate
        attributeName="stroke-dashoffset"
        from="100"
        to="0"
        dur={`${seconds}s`}
        repeatCount="indefinite"
      />
    </path>
  )
}

function seconds(dx: number, dy: number, mode: FlowEdgeData['pulse']): number {
  const base = Math.min(4, Math.max(1.4, Math.hypot(dx, dy) / 160))
  return mode === 'fast' ? base / 2.5 : base
}

function showStreak(data: FlowEdgeData | undefined): boolean {
  return (data?.pulse ?? 'normal') !== 'none' && !data?.dim && !reducedMotion()
}

function edgeLook(data: FlowEdgeData | undefined, fallback: string, width: number) {
  const color = data?.color ?? fallback
  const opacity = data?.dim ? 0.3 : showStreak(data) ? CARRIER_OPACITY : 1
  return {
    color,
    style: { stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, opacity }
  }
}

/** A run-order line (next / yes / no / fork). */
export function WorkflowFlowEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const c = centred(props)
  const path = wirePath(c, data)
  const { color, style } = edgeLook(data, FLOW_COLOR, 3)
  return (
    <>
      <BaseEdge id={props.id} path={path} style={style} />
      {showStreak(data) ? (
        <Streak
          path={path}
          color={color}
          seconds={seconds(c.targetX - c.sourceX, c.targetY - c.sourceY, data?.pulse)}
        />
      ) : null}
      {data?.editable ? <RemoveButton id={props.id} path={path} selected={props.selected} /> : null}
    </>
  )
}

/**
 * A loop-back line: it leaves the step's right connector, drops below both steps and comes back into
 * the earlier step's left connector, so it never lies on top of the forward line.
 */
export function WorkflowLoopEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const { sourceX, sourceY, targetX, targetY } = centred(props)
  const low = Math.max(sourceY, targetY) + LOOP_DROP
  const r = LOOP_REACH
  const looped = [
    `M ${sourceX} ${sourceY}`,
    `C ${sourceX + r * 2} ${sourceY}, ${sourceX + r * 2} ${low}, ${sourceX - r} ${low}`,
    `L ${targetX + r} ${low}`,
    `C ${targetX - r * 2} ${low}, ${targetX - r * 2} ${targetY}, ${targetX} ${targetY}`
  ].join(' ')
  // Why: a tied loop line follows its ties instead of the drop below.
  const path = data?.vias?.length
    ? viaPath({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, data.vias)
    : looped
  const { color, style } = edgeLook(data, '#f59e0b', 2.5)
  return (
    <>
      <BaseEdge id={props.id} path={path} style={{ ...style, strokeDasharray: '6 5' }} />
      {showStreak(data) ? (
        <Streak
          path={path}
          color={color}
          seconds={seconds(sourceX - targetX, LOOP_DROP * 2, data?.pulse) * 1.5}
        />
      ) : null}
      {data?.editable ? <RemoveButton id={props.id} path={path} selected={props.selected} /> : null}
    </>
  )
}

/** A role → slot line in the agent's colour; its slower streak runs from the role to the step. */
export function WorkflowRoleEdge(props: EdgeProps): React.JSX.Element {
  const data = props.data as FlowEdgeData | undefined
  const c = centred(props)
  const path = wirePath(c, data)
  const { color, style } = edgeLook(data, '#71717a', 2.5)
  return (
    <>
      <BaseEdge id={props.id} path={path} style={style} />
      {showStreak(data) ? (
        <Streak
          path={path}
          color={color}
          seconds={seconds(c.targetX - c.sourceX, c.targetY - c.sourceY, data?.pulse) * 1.6}
        />
      ) : null}
      {data?.editable ? <RemoveButton id={props.id} path={path} selected={props.selected} /> : null}
    </>
  )
}

export const WORKFLOW_EDGE_TYPES = {
  tenureFlow: WorkflowFlowEdge,
  tenureLoop: WorkflowLoopEdge,
  tenureRole: WorkflowRoleEdge
}
