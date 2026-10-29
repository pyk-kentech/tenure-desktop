import React, { useCallback, useRef, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnectEnd,
  type OnReconnect,
  type OnEdgesChange,
  type OnNodesChange
} from '@xyflow/react'
import { WORKFLOW_NODE_TYPES } from './WorkflowNodes'
import { WORKFLOW_EDGE_TYPES } from './WorkflowEdges'
import { WorkflowAddMenu, type AddItem } from './WorkflowAddMenu'
import type { DragOrigin } from './use-workflow-graph'
import { PREV_HANDLE, type WorkflowNode } from './workflow-model'
import { TieCutOverlay, WorkflowTieLayer } from './WorkflowTies'
import { useTieCut } from './use-tie-cut'
import type { WorkflowTiesState } from './use-workflow-ties'
import { useShortcutKey, WorkflowShortcuts } from './WorkflowShortcuts'

const MENU_W = 240
const MENU_H = 300

type MenuState = { x: number; y: number; flow: { x: number; y: number }; from?: DragOrigin }

/**
 * tenure: the editor canvas (DESIGN.md 36.32, 36.33). Double-clicking empty space, or dropping a line
 * there, opens a search popup; the picked node lands at that spot and joins the dropped line.
 */
export function WorkflowCanvas(props: {
  nodes: WorkflowNode[]
  edges: Edge[]
  onNodesChange: OnNodesChange<WorkflowNode>
  onEdgesChange: OnEdgesChange<Edge>
  onConnect: (c: Connection) => void
  onReconnect: OnReconnect
  isValidConnection: (c: Connection | Edge) => boolean
  onSelect: (id: string | null) => void
  onAdd: (item: AddItem, position: { x: number; y: number }, from?: DragOrigin) => void
  ties: WorkflowTiesState
  readOnly: boolean
  dark: boolean
}): React.JSX.Element {
  const { screenToFlowPosition } = useReactFlow()
  const wrap = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  // Why: React Flow reports a moved line's drop through onConnectEnd too; that must not open the menu.
  const reconnecting = useRef(false)
  const tieCut = useTieCut(wrap, !props.readOnly, props.ties)
  const [keys, setKeys] = useState(false)
  const toggleKeys = useCallback(() => setKeys((v) => !v), [])
  useShortcutKey(!props.readOnly, toggleKeys)

  const openAt = useCallback(
    (clientX: number, clientY: number, from?: DragOrigin) => {
      const box = wrap.current?.getBoundingClientRect()
      if (!box) {
        return
      }
      // Why: keep the popup inside the canvas when opened near its right or bottom edge.
      setMenu({
        x: Math.max(8, Math.min(clientX - box.left, box.width - MENU_W - 8)),
        y: Math.max(8, Math.min(clientY - box.top, box.height - MENU_H - 8)),
        flow: screenToFlowPosition({ x: clientX, y: clientY }),
        from
      })
    },
    [screenToFlowPosition]
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (
        reconnecting.current ||
        props.readOnly ||
        state.isValid ||
        !state.fromNode ||
        !state.fromHandle
      ) {
        return
      }
      const point = 'changedTouches' in event ? event.changedTouches[0] : event
      openAt(point.clientX, point.clientY, {
        nodeId: state.fromNode.id,
        handleId: state.fromHandle.id ?? '',
        handleType: state.fromHandle.type
      })
    },
    [openAt, props.readOnly]
  )

  // Why: dragging back from a role slot can only be answered by a role; anything else adds a step.
  const fromSlot =
    !!menu?.from && menu.from.handleType === 'target' && menu.from.handleId !== PREV_HANDLE
  return (
    <div
      ref={wrap}
      className={`relative h-full w-full ${tieCut.armed ? 'cursor-crosshair' : ''}`}
      {...tieCut.handlers}
      onDoubleClick={(e) => {
        if (
          !props.readOnly &&
          e.target instanceof Element &&
          e.target.closest('.react-flow__pane')
        ) {
          openAt(e.clientX, e.clientY)
        }
      }}
    >
      <ReactFlow
        nodes={props.nodes}
        edges={props.edges}
        nodeTypes={WORKFLOW_NODE_TYPES}
        edgeTypes={WORKFLOW_EDGE_TYPES}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={props.onConnect}
        onConnectEnd={onConnectEnd}
        edgesReconnectable={!props.readOnly}
        onReconnectStart={() => {
          reconnecting.current = true
        }}
        onReconnect={props.onReconnect}
        onReconnectEnd={(_event, edge, _handleType, state) => {
          reconnecting.current = false
          // Why: like ComfyUI, a line end dropped on empty canvas cuts the line.
          if (!state.isValid) {
            props.onEdgesChange([{ type: 'remove', id: edge.id }])
          }
        }}
        nodesConnectable={!props.readOnly}
        // Why: while Z is held a drag draws a cut, so the canvas must not pan, drag or select.
        panOnDrag={!tieCut.armed}
        nodesDraggable={!tieCut.armed}
        elementsSelectable={!tieCut.armed}
        isValidConnection={props.isValidConnection}
        onSelectionChange={({ nodes }) => props.onSelect(nodes[0]?.id ?? null)}
        defaultEdgeOptions={{ type: 'tenureFlow' }}
        colorMode={props.dark ? 'dark' : 'light'}
        deleteKeyCode={props.readOnly ? null : ['Delete', 'Backspace']}
        zoomOnDoubleClick={false}
        fitView
        // Why: a small workflow fitted to the screen came out huge; never zoom past 100%.
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <WorkflowTieLayer ties={props.ties} editable={!props.readOnly} />
      </ReactFlow>
      {tieCut.cut ? <TieCutOverlay cut={tieCut.cut} /> : null}
      {props.readOnly ? null : <WorkflowShortcuts open={keys} onToggle={toggleKeys} />}
      {menu ? (
        <WorkflowAddMenu
          x={menu.x}
          y={menu.y}
          allowRoles={!menu.from || fromSlot}
          allowSteps={!fromSlot}
          onClose={() => setMenu(null)}
          onPick={(item) => {
            props.onAdd(item, menu.flow, menu.from)
            setMenu(null)
          }}
        />
      ) : null}
    </div>
  )
}
