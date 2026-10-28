import type { Edge } from '@xyflow/react'
import {
  isFlowEdge,
  isRoleNode,
  isStepNode,
  type StepNode,
  type WorkflowNode
} from './workflow-model'

// tenure: auto-tidy for the workflow editor (DESIGN.md 36.29, 36.30).

const ROLE_COLUMN_W = 240
const STEP_GAP_X = 300
const LANE_GAP_Y = 200
const ROLE_GAP_Y = 90

/** Steps nobody flows into (fork targets excluded): where a run starts. */
export function headSteps(nodes: WorkflowNode[], edges: Edge[]): StepNode[] {
  const steps = nodes.filter(isStepNode)
  const entered = new Set(edges.filter(isFlowEdge).map((e) => e.target))
  return steps.filter((s) => !entered.has(s.id))
}

/**
 * Columns (ranks) by walking flow edges breadth-first from the start; an edge to an already
 * placed step is a loop back and does not move it. Each column keeps its steps in lanes.
 */
export function rankSteps(nodes: WorkflowNode[], edges: Edge[]): StepNode[][] {
  const steps = nodes.filter(isStepNode)
  const byId = new Map(steps.map((s) => [s.id, s]))
  const flow = edges.filter(isFlowEdge)
  const rank = new Map<string, number>()
  const heads = headSteps(nodes, edges)
  const queue = (heads.length ? heads : steps.slice(0, 1)).map((s) => s.id)
  queue.forEach((id) => rank.set(id, 0))
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    for (const e of flow.filter((f) => f.source === id)) {
      if (byId.has(e.target) && !rank.has(e.target)) {
        rank.set(e.target, (rank.get(id) ?? 0) + 1)
        queue.push(e.target)
      }
    }
  }
  let extra = Math.max(-1, ...rank.values()) + 1
  for (const s of steps) {
    if (!rank.has(s.id)) {
      rank.set(s.id, extra++)
      queue.push(s.id)
    }
  }
  const columns: StepNode[][] = []
  for (const id of queue) {
    const r = rank.get(id) ?? 0
    ;(columns[r] ??= []).push(byId.get(id)!)
  }
  return columns.filter(Boolean)
}

/**
 * Auto-tidy (DESIGN.md 36.32): roles in a column on the left, ordered by the first step that uses
 * them; steps left → right by rank with branch lanes stacked, so role lines run left to right too.
 */
export function layoutGraph(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  const columns = rankSteps(nodes, edges)
  const ordered = columns.flat()
  const rank = (roleId: string) => {
    const i = ordered.findIndex((s) => edges.some((e) => e.source === roleId && e.target === s.id))
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const roles = nodes.filter(isRoleNode).sort((a, b) => rank(a.id) - rank(b.id))
  const pos = new Map<string, { x: number; y: number }>()
  roles.forEach((role, k) => pos.set(role.id, { x: 0, y: k * ROLE_GAP_Y }))
  columns.forEach((col, r) => {
    col.forEach((s, lane) =>
      pos.set(s.id, { x: ROLE_COLUMN_W + r * STEP_GAP_X, y: lane * LANE_GAP_Y })
    )
  })
  return nodes.map((node) => ({ ...node, position: pos.get(node.id) ?? node.position }))
}
