import React, { useRef } from 'react'
import { ViewportPortal, useReactFlow } from '@xyflow/react'
import { translate } from '@/i18n/i18n'
import { snapAngle, tieLength, type Tie } from './workflow-ties'
import type { WorkflowTiesState } from './use-workflow-ties'
import type { TieCut } from './use-tie-cut'

// tenure: cable ties drawn over the lines they bundle (DESIGN.md 36.34). Drag to move, Shift-drag
// to turn in 15° steps (Alt: freely), double-click to undo.

// Cable-tie colours; each tie keeps one by its id.
const TIE_COLORS = ['#27272a', '#e4e4e7', '#dc2626', '#2563eb', '#d97706', '#16a34a']

function colorOf(id: string): string {
  let h = 0
  for (const ch of id) {
    h = (h * 31 + ch.charCodeAt(0)) | 0
  }
  return TIE_COLORS[Math.abs(h) % TIE_COLORS.length]
}

type Drag = { id: string; start: { x: number; y: number }; tie: Tie; turn: boolean }

function TieBand(props: { tie: Tie; editable: boolean; ties: WorkflowTiesState }) {
  const { screenToFlowPosition } = useReactFlow()
  const drag = useRef<Drag | null>(null)
  const { tie, editable, ties } = props
  return (
    <div
      className={`nodrag nopan absolute rounded-[3px] border border-black/30 shadow-sm ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      title={editable ? translate('tenure.workflow.tie.title', 'Cable tie') : undefined}
      style={{
        left: tie.x,
        top: tie.y,
        width: 7,
        height: tieLength(tie),
        background: colorOf(tie.id),
        transform: `translate(-50%, -50%) rotate(${tie.angle}deg)`,
        pointerEvents: editable ? 'all' : 'none'
      }}
      onPointerDown={(e) => {
        if (!editable || e.button !== 0) {
          return
        }
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        const start = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        drag.current = { id: tie.id, start, tie, turn: e.shiftKey }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) {
          return
        }
        const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        if (d.turn) {
          // Why: the lines run toward the pointer, so the tie turns with the drag.
          const deg = (Math.atan2(at.y - d.tie.y, at.x - d.tie.x) * 180) / Math.PI
          ties.update(d.id, { angle: snapAngle(deg, e.altKey ? 1 : 15) })
        } else {
          ties.update(d.id, { x: d.tie.x + at.x - d.start.x, y: d.tie.y + at.y - d.start.y })
        }
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onDoubleClick={(e) => {
        if (editable) {
          e.stopPropagation()
          ties.remove(tie.id)
        }
      }}
    />
  )
}

export function WorkflowTieLayer(props: {
  ties: WorkflowTiesState
  editable: boolean
}): React.JSX.Element {
  return (
    <ViewportPortal>
      {props.ties.ties.map((tie) => (
        <TieBand key={tie.id} tie={tie} editable={props.editable} ties={props.ties} />
      ))}
    </ViewportPortal>
  )
}

/** The cut being dragged with Z held: dots where it crosses lines, red when it would undo a tie. */
export function TieCutOverlay({ cut }: { cut: TieCut }): React.JSX.Element {
  const color = cut.overTie ? '#ef4444' : '#0ea5e9'
  return (
    <svg className="pointer-events-none absolute inset-0 size-full">
      <line
        x1={cut.from.x}
        y1={cut.from.y}
        x2={cut.to.x}
        y2={cut.to.y}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
      {cut.crossings.map((t) => (
        <circle
          key={t}
          cx={cut.from.x + (cut.to.x - cut.from.x) * t}
          cy={cut.from.y + (cut.to.y - cut.from.y) * t}
          r={4}
          fill="#ffffff"
          stroke={color}
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}
