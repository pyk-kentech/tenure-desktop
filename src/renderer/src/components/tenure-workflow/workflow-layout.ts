import type { Edge } from '@xyflow/react'
import {
  isFlowEdge,
  isRoleNode,
  isStepNode,
  type StepNode,
  type WorkflowNode
} from './workflow-model'

// tenure: auto-tidy for the workflow editor (DESIGN.md 36.29, 36.30).

const STEP_GAP_X = 340
const ROLE_GAP_X = 190
const LANE_GAP_Y = 190
const ROLE_GAP_Y = 110

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
 * Auto-tidy: steps left → right by rank, branch lanes stacked; each role sits in a row under the
 * column of the first step that uses it, and a column widens to fit its roles.
 */
export function layoutGraph(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  const columns = rankSteps(nodes, edges)
  const roles = nodes.filter(isRoleNode)
  const ordered = columns.flat()
  const columnOf = new Map(columns.flatMap((col, r) => col.map((s) => [s.id, r] as const)))
  const firstUse = new Map<string, number>()
  for (const role of roles) {
    const step = ordered.find((s) => edges.some((e) => e.source === role.id && e.target === s.id))
    if (step) {
      firstUse.set(role.id, columnOf.get(step.id) ?? 0)
    }
  }
  const lanes = Math.max(1, ...columns.map((c) => c.length))
  const roleY = (lanes - 1) * LANE_GAP_Y + 260
  const pos = new Map<string, { x: number; y: number }>()
  let cursor = 0
  columns.forEach((col, r) => {
    col.forEach((s, lane) => pos.set(s.id, { x: cursor, y: lane * LANE_GAP_Y }))
    const mine = roles.filter((role) => firstUse.get(role.id) === r)
    mine.forEach((role, k) => pos.set(role.id, { x: cursor + k * ROLE_GAP_X, y: roleY }))
    cursor += Math.max(STEP_GAP_X, mine.length * ROLE_GAP_X)
  })
  roles
    .filter((r) => !firstUse.has(r.id))
    .forEach((r, k) => pos.set(r.id, { x: -ROLE_GAP_X - 60, y: k * ROLE_GAP_Y }))
  return nodes.map((node) => ({ ...node, position: pos.get(node.id) ?? node.position }))
}
