import type { Edge } from '@xyflow/react'
import type { FlowEdgeData, WireStyle } from './WorkflowEdges'
import {
  AGENT_COLOR,
  FORK_HANDLE,
  OUTPUT_COLOR,
  PREV_HANDLE,
  ROLE_HANDLE,
  isFlowEdge,
  isRoleNode,
  isStepNode,
  type StepNode,
  type WorkflowNode
} from './workflow-model'
import type { StepProgress, StepStatus } from './run-progress'
import type { Via } from './workflow-ties'

// tenure: how the editor shows the graph (DESIGN.md 36.32): agent-coloured role lines, loop lines,
// and in the run view each step's status plus which lines the run actually took.

export function stepKey(node: StepNode): string {
  const id = node.data.params.id
  return typeof id === 'string' && id ? id : node.data.kind
}

/** The engine ids the run view needs, with each parallel step's branches. */
export function stepRefs(nodes: WorkflowNode[], edges: Edge[]) {
  const steps = nodes.filter(isStepNode)
  const keyOf = new Map(steps.map((s) => [s.id, stepKey(s)]))
  return steps.map((s) => ({
    id: stepKey(s),
    kind: s.data.kind,
    branches: edges
      .filter((e) => e.source === s.id && e.sourceHandle === FORK_HANDLE)
      .map((e) => keyOf.get(e.target) ?? '')
  }))
}

const REACHED: StepStatus[] = ['done', 'running', 'failed']
// A line back to an earlier step means "repeat"; it keeps one colour whatever output it leaves.
const LOOP_COLOR = '#f59e0b'

/** Which connectors have a line, and in what colour (a connected dot takes its line's colour). */
export function connectedSockets(
  nodes: WorkflowNode[],
  edges: Edge[]
): Map<string, Record<string, string>> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, Record<string, string>>()
  const mark = (nodeId: string, handle: string | null | undefined, color: string) => {
    if (!handle) {
      return
    }
    const rec = out.get(nodeId) ?? {}
    rec[handle] ??= color
    out.set(nodeId, rec)
  }
  for (const e of edges) {
    const source = byId.get(e.source)
    if (isFlowEdge(e)) {
      mark(e.source, e.sourceHandle, OUTPUT_COLOR[e.sourceHandle ?? 'next'] ?? OUTPUT_COLOR.next)
      mark(e.target, PREV_HANDLE, OUTPUT_COLOR.next)
    } else if (source && isRoleNode(source)) {
      const color = AGENT_COLOR[source.data.def.agent] ?? '#71717a'
      mark(e.source, ROLE_HANDLE, color)
      mark(e.target, e.targetHandle, color)
    }
  }
  return out
}

export function displayGraph(
  nodes: WorkflowNode[],
  edges: Edge[],
  progress: Map<string, StepProgress> | null,
  decisions: Record<string, string> | undefined,
  wire: WireStyle = 'bezier',
  editable = true,
  routes = new Map<string, Via[]>()
): { nodes: WorkflowNode[]; edges: Edge[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const statusOf = (id: string): StepStatus | undefined => {
    const n = byId.get(id)
    return n && isStepNode(n) ? progress?.get(stepKey(n))?.status : undefined
  }
  const sockets = connectedSockets(nodes, edges)
  const shownNodes = nodes.map((n): WorkflowNode => {
    if (isStepNode(n)) {
      const stepProgress = progress
        ? (progress.get(stepKey(n)) ?? { status: 'pending' as const, lines: [] })
        : undefined
      return { ...n, data: { ...n.data, sockets: sockets.get(n.id) ?? {}, progress: stepProgress } }
    }
    return isRoleNode(n) ? { ...n, data: { ...n.data, sockets: sockets.get(n.id) ?? {} } } : n
  })
  const shownEdges = edges.map((e): Edge => {
    const source = byId.get(e.source)
    if (!isFlowEdge(e)) {
      const agent = source && isRoleNode(source) ? source.data.def.agent : ''
      return {
        ...e,
        type: 'tenureRole',
        // Why: in the run view only the roles working on the running step carry a streak.
        className: 'group',
        data: {
          color: AGENT_COLOR[agent],
          wire,
          editable,
          vias: routes.get(e.id),
          pulse: !progress || statusOf(e.target) === 'running' ? 'normal' : 'none'
        } satisfies FlowEdgeData
      }
    }
    const target = byId.get(e.target)
    const loop = (target?.position.x ?? 0) <= (source?.position.x ?? 0)
    // Why: like ComfyUI, a line takes the colour of the output it leaves (next grey, yes green, no red).
    const color = loop ? LOOP_COLOR : (OUTPUT_COLOR[e.sourceHandle ?? 'next'] ?? OUTPUT_COLOR.next)
    const vias = routes.get(e.id)
    let data: FlowEdgeData = { pulse: 'normal', color, wire, editable, vias }
    if (progress && source && isStepNode(source)) {
      const t = statusOf(e.target)
      let taken = statusOf(e.source) === 'done' && !!t && REACHED.includes(t)
      if (source.data.kind === 'branch') {
        const key = stepKey(source)
        // Why: a branch is "done" either way; only the line it actually chose was taken.
        taken =
          taken &&
          Object.entries(decisions ?? {}).some(
            ([k, v]) => k.startsWith(`${key}#`) && v === e.sourceHandle
          )
      }
      data = taken
        ? { pulse: t === 'running' ? 'fast' : 'normal', color, wire, vias }
        : { dim: true, pulse: 'none', color, wire, vias }
    }
    // Why: 'group' lets a hovered line reveal its remove button (WorkflowEdges.RemoveButton).
    return { ...e, type: loop ? 'tenureLoop' : 'tenureFlow', className: 'group', data }
  })
  return { nodes: shownNodes, edges: shownEdges }
}
