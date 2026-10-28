import { useCallback } from 'react'
import { useEdgesState, useNodesState, type Connection, type Edge } from '@xyflow/react'
import {
  NEXT_HANDLE,
  PREV_HANDLE,
  ROLE_HANDLE,
  STEP_SLOTS,
  isRoleNode,
  isStepNode,
  layoutGraph,
  newStepNodeId,
  orderEdge,
  orderSteps,
  roleNodeId,
  slotEdge,
  slotMax,
  toGraph,
  type RoleDef,
  type StepKind,
  type WorkflowDef,
  type WorkflowNode
} from './workflow-model'

const ROLE_NAME_RE = /^[a-z][a-z0-9_]{0,23}$/

/** Node graph state plus the edits the editor offers (connect rules follow the engine's step slots). */
export function useWorkflowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const load = useCallback(
    (def: WorkflowDef) => {
      const graph = toGraph(def)
      setNodes(graph.nodes)
      setEdges(graph.edges)
    },
    [setNodes, setEdges]
  )

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const target = nodes.find((n) => n.id === c.target)
      if (!target || !isStepNode(target) || c.source === c.target) {
        return false
      }
      if (c.sourceHandle === ROLE_HANDLE) {
        return STEP_SLOTS[target.data.kind].some((s) => s.key === c.targetHandle)
      }
      return c.sourceHandle === NEXT_HANDLE && c.targetHandle === PREV_HANDLE
    },
    [nodes]
  )

  const onConnect = useCallback(
    (c: Connection) => {
      const target = nodes.find((n) => n.id === c.target)
      const source = nodes.find((n) => n.id === c.source)
      if (!target || !source || !isStepNode(target)) {
        return
      }
      setEdges((es) => {
        if (c.sourceHandle === ROLE_HANDLE && isRoleNode(source) && c.targetHandle) {
          const slot = c.targetHandle
          const sameSlot = es.filter((e) => e.target === target.id && e.targetHandle === slot)
          if (sameSlot.some((e) => e.source === source.id)) {
            return es
          }
          // Why: a full slot drops its oldest role so the newest drag always wins.
          const drop = sameSlot.length >= slotMax(target.data.kind, slot) ? sameSlot[0]?.id : null
          return [...es.filter((e) => e.id !== drop), slotEdge(source.data.name, target.id, slot)]
        }
        const kept = es.filter(
          (e) =>
            !(e.source === source.id && e.sourceHandle === NEXT_HANDLE) &&
            !(e.target === target.id && e.targetHandle === PREV_HANDLE)
        )
        return [...kept, orderEdge(source.id, target.id)]
      })
    },
    [nodes, setEdges]
  )

  const addRole = useCallback(
    (agent: 'claude' | 'codex') => {
      setNodes((ns) => {
        const taken = new Set(ns.filter(isRoleNode).map((n) => n.data.name))
        let name: string = agent
        for (let i = 2; taken.has(name); i++) {
          name = `${agent}${i}`
        }
        const node: WorkflowNode = {
          id: roleNodeId(name),
          type: 'tenureRole',
          position: { x: -340, y: taken.size * 130 },
          data: { name, def: { agent } }
        }
        return [...ns, node]
      })
    },
    [setNodes]
  )

  const addStep = useCallback(
    (kind: StepKind) => {
      const id = newStepNodeId()
      const { steps } = orderSteps(nodes, edges)
      const last = steps.at(-1)
      const node: WorkflowNode = {
        id,
        type: 'tenureStep',
        position: { x: last ? last.position.x + 340 : 0, y: 0 },
        data: { kind, params: {} }
      }
      setNodes((ns) => [...ns, node])
      if (last) {
        // Why: new steps join the end of the line, which is what beginners expect.
        setEdges((es) => [...es, orderEdge(last.id, id)])
      }
    },
    [nodes, edges, setNodes, setEdges]
  )

  const renameRole = useCallback(
    (id: string, name: string): boolean => {
      const newId = roleNodeId(name)
      if (!ROLE_NAME_RE.test(name) || (newId !== id && nodes.some((n) => n.id === newId))) {
        return false
      }
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id && isRoleNode(n) ? { ...n, id: newId, data: { ...n.data, name } } : n
        )
      )
      setEdges((es) =>
        es.map((e) => (e.source === id ? { ...e, id: e.id.replace(id, newId), source: newId } : e))
      )
      return true
    },
    [nodes, setNodes, setEdges]
  )

  const changeRole = useCallback(
    (id: string, def: RoleDef) =>
      setNodes((ns) =>
        ns.map((n) => (n.id === id && isRoleNode(n) ? { ...n, data: { ...n.data, def } } : n))
      ),
    [setNodes]
  )

  const changeStep = useCallback(
    (id: string, params: Record<string, unknown>) =>
      setNodes((ns) =>
        ns.map((n) => (n.id === id && isStepNode(n) ? { ...n, data: { ...n.data, params } } : n))
      ),
    [setNodes]
  )

  const deleteNode = useCallback(
    (id: string) => {
      const before = edges.find((e) => e.target === id && e.targetHandle === PREV_HANDLE)?.source
      const after = edges.find((e) => e.source === id && e.sourceHandle === NEXT_HANDLE)?.target
      setNodes((ns) => ns.filter((n) => n.id !== id))
      setEdges((es) => {
        const kept = es.filter((e) => e.source !== id && e.target !== id)
        // Why: removing a middle step keeps the line joined.
        return before && after ? [...kept, orderEdge(before, after)] : kept
      })
    },
    [edges, setNodes, setEdges]
  )

  const tidy = useCallback(() => setNodes((ns) => layoutGraph(ns, edges)), [edges, setNodes])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    load,
    addRole,
    addStep,
    renameRole,
    changeRole,
    changeStep,
    deleteNode,
    tidy
  }
}
