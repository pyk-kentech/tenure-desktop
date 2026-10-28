import type { Edge } from '@xyflow/react'
import type { FlowEdgeData } from './WorkflowEdges'
import {
  AGENT_COLOR,
  FORK_HANDLE,
  isFlowEdge,
  isRoleNode,
  isStepNode,
  type StepNode,
  type WorkflowNode
} from './workflow-model'
import type { StepProgress, StepStatus } from './run-progress'

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

export function displayGraph(
  nodes: WorkflowNode[],
  edges: Edge[],
  progress: Map<string, StepProgress> | null,
  decisions: Record<string, string> | undefined
): { nodes: WorkflowNode[]; edges: Edge[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const statusOf = (id: string): StepStatus | undefined => {
    const n = byId.get(id)
    return n && isStepNode(n) ? progress?.get(stepKey(n))?.status : undefined
  }
  const shownNodes = progress
    ? nodes.map((n) =>
        isStepNode(n)
          ? {
              ...n,
              data: {
                ...n.data,
                progress: progress.get(stepKey(n)) ?? { status: 'pending' as const, lines: [] }
              }
            }
          : n
      )
    : nodes
  const shownEdges = edges.map((e): Edge => {
    const source = byId.get(e.source)
    if (!isFlowEdge(e)) {
      const agent = source && isRoleNode(source) ? source.data.def.agent : ''
      return {
        ...e,
        type: 'tenureRole',
        data: { color: AGENT_COLOR[agent] } satisfies FlowEdgeData
      }
    }
    const target = byId.get(e.target)
    const loop = (target?.position.x ?? 0) <= (source?.position.x ?? 0)
    let data: FlowEdgeData = { pulse: 'normal' }
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
      data = taken ? { pulse: t === 'running' ? 'fast' : 'normal' } : { dim: true, pulse: 'none' }
    }
    return { ...e, type: loop ? 'tenureLoop' : 'tenureFlow', data }
  })
  return { nodes: shownNodes, edges: shownEdges }
}
