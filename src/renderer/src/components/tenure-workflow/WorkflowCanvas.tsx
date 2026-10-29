import React, { useCallback, useRef, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnectEnd,
  type OnEdgesChange,
  type OnNodesChange
} from '@xyflow/react'
import { WORKFLOW_NODE_TYPES } from './WorkflowNodes'
import { WORKFLOW_EDGE_TYPES } from './WorkflowEdges'
import { WorkflowAddMenu, type AddItem } from './WorkflowAddMenu'
import type { DragOrigin } from './use-workflow-graph'
import { PREV_HANDLE, type WorkflowNode } from './workflow-model'

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
  isValidConnection: (c: Connection | Edge) => boolean
  onSelect: (id: string | null) => void
  onAdd: (item: AddItem, position: { x: number; y: number }, from?: DragOrigin) => void
  readOnly: boolean
  dark: boolean
}): React.JSX.Element {
  const { screenToFlowPosition } = useReactFlow()
  const wrap = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const openAt = useCallback(
    (clientX: number, clientY: number, from?: DragOrigin) => {
      const box = wrap.current?.getBoundingClientRect()
      if (!box) {
        return
      }
      setMenu({
        x: clientX - box.left,
        y: clientY - box.top,
        flow: screenToFlowPosition({ x: clientX, y: clientY }),
        from
      })
    },
    [screenToFlowPosition]
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      if (props.readOnly || state.isValid || !state.fromNode || !state.fromHandle) {
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
      className="relative h-full w-full"
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
        nodesConnectable={!props.readOnly}
        isValidConnection={props.isValidConnection}
        onSelectionChange={({ nodes }) => props.onSelect(nodes[0]?.id ?? null)}
        defaultEdgeOptions={{ type: 'tenureFlow' }}
        colorMode={props.dark ? 'dark' : 'light'}
        deleteKeyCode={props.readOnly ? null : ['Delete', 'Backspace']}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
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
