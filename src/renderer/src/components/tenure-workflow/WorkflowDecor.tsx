import React, { useRef, useState } from 'react'
import { ViewportPortal, useReactFlow } from '@xyflow/react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'
import { GROUP_HEAD, groupMembers, type Bend, type Group } from './workflow-decor'
import type { WorkflowDecorState } from './use-workflow-decor'
import type { Point } from './workflow-ties'
import type { WorkflowNode } from './workflow-model'

// tenure: bend points and group boxes on the canvas (DESIGN.md 36.39). A bend is a small dot on its
// line: drag to move, double-click to remove. A group box sits behind the nodes; drag its title bar
// to move it with the nodes inside, drag the corner to resize, double-click the title to rename.

function useFlowDrag() {
  const { screenToFlowPosition } = useReactFlow()
  return (e: React.PointerEvent): Point => screenToFlowPosition({ x: e.clientX, y: e.clientY })
}

function BendDot(props: { bend: Bend; editable: boolean; decor: WorkflowDecorState }) {
  const at = useFlowDrag()
  const drag = useRef(false)
  const { bend, editable, decor } = props
  return (
    <div
      className={`nodrag nopan absolute size-2.5 rounded-full border-2 border-background bg-muted-foreground shadow ${editable ? 'cursor-move hover:bg-foreground' : ''}`}
      title={editable ? translate('tenure.workflow.bend.title', 'Bend point') : undefined}
      style={{
        left: bend.x,
        top: bend.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: editable ? 'all' : 'none'
      }}
      onPointerDown={(e) => {
        if (!editable || e.button !== 0) {
          return
        }
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = true
      }}
      onPointerMove={(e) => drag.current && decor.moveBend(bend.id, at(e))}
      onPointerUp={() => {
        drag.current = false
      }}
      onDoubleClick={(e) => {
        if (editable) {
          e.stopPropagation()
          decor.removeBend(bend.id)
        }
      }}
    />
  )
}

// Everything is measured from where the drag started, so fast moves between renders lose nothing.
type GroupDrag = {
  kind: 'move' | 'size'
  start: Point
  box: Group
  members: Map<string, Point>
}

function GroupBox(props: {
  group: Group
  editable: boolean
  decor: WorkflowDecorState
  nodes: WorkflowNode[]
  onMoveNodes: (to: Map<string, Point>) => void
}) {
  const at = useFlowDrag()
  const drag = useRef<GroupDrag | null>(null)
  const [naming, setNaming] = useState(false)
  const { group: g, editable, decor } = props
  const start = (kind: GroupDrag['kind']) => (e: React.PointerEvent) => {
    if (!editable || e.button !== 0) {
      return
    }
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const inside = new Set(kind === 'move' ? groupMembers(g, props.nodes) : [])
    drag.current = {
      kind,
      start: at(e),
      box: g,
      members: new Map(props.nodes.filter((n) => inside.has(n.id)).map((n) => [n.id, n.position]))
    }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) {
      return
    }
    const p = at(e)
    const dx = p.x - d.start.x
    const dy = p.y - d.start.y
    if (d.kind === 'size') {
      decor.updateGroup(g.id, {
        w: Math.max(120, d.box.w + dx),
        h: Math.max(GROUP_HEAD + 40, d.box.h + dy)
      })
      return
    }
    decor.updateGroup(g.id, { x: d.box.x + dx, y: d.box.y + dy })
    if (d.members.size) {
      props.onMoveNodes(
        new Map([...d.members].map(([id, q]) => [id, { x: q.x + dx, y: q.y + dy }]))
      )
    }
  }
  const end = () => {
    drag.current = null
  }
  return (
    <>
      <div
        className="absolute rounded-lg border-2 border-sky-500/40 bg-sky-500/[0.06]"
        style={{ left: g.x, top: g.y, width: g.w, height: g.h, zIndex: -1, pointerEvents: 'none' }}
      />
      {/* Why: the box sits behind lines and nodes, but its title bar and corner must stay on top
          so a line crossing them never takes the click. */}
      <div
        className="absolute p-[2px]"
        style={{ left: g.x, top: g.y, width: g.w, height: g.h, pointerEvents: 'none' }}
      >
        <div
          className={`nodrag nopan flex items-center gap-1 rounded-t-md bg-sky-500/15 px-2 text-xs font-medium text-sky-900 dark:text-sky-100 ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ height: GROUP_HEAD, pointerEvents: editable ? 'all' : 'none' }}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onDoubleClick={(e) => {
            if (editable) {
              e.stopPropagation()
              setNaming(true)
            }
          }}
        >
          {naming ? (
            <input
              data-tenure-group-title
              autoFocus
              defaultValue={g.title}
              maxLength={80}
              className="h-5 min-w-0 flex-1 rounded border bg-background px-1 text-xs font-normal text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => {
                decor.updateGroup(g.id, { title: e.currentTarget.value.trim() })
                setNaming(false)
              }}
              onKeyDown={(e) => {
                if (isImeOwnedKeyboardEvent(e)) {
                  return
                }
                if (e.key === 'Enter' || e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.key === 'Escape') {
                    e.currentTarget.value = g.title
                  }
                  e.currentTarget.blur()
                }
              }}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">
              {g.title || translate('tenure.workflow.group.untitled', 'Group')}
            </span>
          )}
          {editable && !naming ? (
            <button
              type="button"
              className="rounded p-0.5 opacity-60 hover:bg-background/60 hover:opacity-100"
              title={translate('tenure.workflow.group.remove', 'Remove the box (nodes stay)')}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => decor.removeGroup(g.id)}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
        {editable ? (
          <div
            className="nodrag nopan absolute -bottom-1 -right-1 size-3 cursor-nwse-resize rounded-sm border-2 border-sky-500/60 bg-background"
            style={{ pointerEvents: 'all' }}
            title={translate('tenure.workflow.group.resize', 'Drag to resize')}
            onPointerDown={start('size')}
            onPointerMove={move}
            onPointerUp={end}
          />
        ) : null}
      </div>
    </>
  )
}

export function WorkflowDecorLayer(props: {
  decor: WorkflowDecorState
  editable: boolean
  nodes: WorkflowNode[]
  // Moves nodes to these positions (ties and bends on their lines follow).
  onMoveNodes: (to: Map<string, Point>) => void
}): React.JSX.Element {
  return (
    <ViewportPortal>
      {props.decor.groups.map((g) => (
        <GroupBox
          key={g.id}
          group={g}
          editable={props.editable}
          decor={props.decor}
          nodes={props.nodes}
          onMoveNodes={props.onMoveNodes}
        />
      ))}
      {props.decor.bends.map((b) => (
        <BendDot key={b.id} bend={b} editable={props.editable} decor={props.decor} />
      ))}
    </ViewportPortal>
  )
}
