import type { Edge, Node } from '@xyflow/react'

// tenure: engine workflow (src/tenure/workflow.py) ⇄ node graph for the editor (DESIGN.md 36.29 M44).
// The engine validates; this module only converts and lays out.

export type StepKind = 'explore' | 'debate' | 'build' | 'audit'
export const STEP_KINDS: StepKind[] = ['explore', 'debate', 'build', 'audit']

export type RoleDef = {
  agent: string
  model?: string
  effort?: string
  instructions?: string
  templates?: Record<string, string>
  step_effort?: Record<string, string>
  step_model?: Record<string, string>
}
export type StepDef = { kind: StepKind; id?: string } & Record<string, unknown>
export type WorkflowDef = {
  name: string
  description: string
  roles: Record<string, RoleDef>
  steps: StepDef[]
}

export type Slot = { key: string; min: number; max: number }
export const STEP_SLOTS: Record<StepKind, Slot[]> = {
  explore: [{ key: 'role', min: 1, max: 1 }],
  debate: [
    { key: 'proposers', min: 1, max: 2 },
    { key: 'synth', min: 0, max: 1 }
  ],
  build: [
    { key: 'implementer', min: 1, max: 1 },
    { key: 'reviewers', min: 1, max: 3 },
    { key: 'rivals', min: 0, max: 1 },
    { key: 'arbiter', min: 0, max: 1 }
  ],
  audit: [{ key: 'roles', min: 1, max: 3 }]
}
// Slots the engine stores as one role name rather than a list.
const SINGLE_SLOTS = new Set(['role', 'synth', 'implementer', 'arbiter'])
const SLOT_KEYS = new Set(Object.values(STEP_SLOTS).flatMap((slots) => slots.map((s) => s.key)))

export type RoleNodeData = { name: string; def: RoleDef }
export type StepNodeData = { kind: StepKind; params: Record<string, unknown> }
export type RoleNode = Node<RoleNodeData, 'tenureRole'>
export type StepNode = Node<StepNodeData, 'tenureStep'>
export type WorkflowNode = RoleNode | StepNode

export const NEXT_HANDLE = 'next'
export const PREV_HANDLE = 'prev'
export const ROLE_HANDLE = 'out'

export function roleNodeId(name: string): string {
  return `role:${name}`
}

let stepSeq = 0
export function newStepNodeId(): string {
  stepSeq += 1
  return `step:${Date.now().toString(36)}-${stepSeq}`
}

export function isStepNode(node: WorkflowNode): node is StepNode {
  return node.type === 'tenureStep'
}

export function isRoleNode(node: WorkflowNode): node is RoleNode {
  return node.type === 'tenureRole'
}

export function slotEdge(role: string, stepId: string, slot: string): Edge {
  const source = roleNodeId(role)
  return {
    id: `${source}->${stepId}:${slot}`,
    source,
    sourceHandle: ROLE_HANDLE,
    target: stepId,
    targetHandle: slot,
    type: 'smoothstep'
  }
}

export function orderEdge(from: string, to: string): Edge {
  return {
    id: `${from}->${to}`,
    source: from,
    sourceHandle: NEXT_HANDLE,
    target: to,
    targetHandle: PREV_HANDLE,
    type: 'smoothstep',
    animated: true
  }
}

export function toGraph(def: WorkflowDef): { nodes: WorkflowNode[]; edges: Edge[] } {
  const nodes: WorkflowNode[] = Object.entries(def.roles).map(([name, role]) => ({
    id: roleNodeId(name),
    type: 'tenureRole',
    position: { x: 0, y: 0 },
    data: { name, def: role }
  }))
  const edges: Edge[] = []
  let prev: string | null = null
  for (const step of def.steps) {
    const id = newStepNodeId()
    const params: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(step)) {
      if (key === 'kind') {
        continue
      }
      if (SLOT_KEYS.has(key)) {
        const names = Array.isArray(value) ? value : [value]
        for (const name of names) {
          if (typeof name === 'string' && def.roles[name]) {
            edges.push(slotEdge(name, id, key))
          }
        }
      } else {
        params[key] = value
      }
    }
    nodes.push({
      id,
      type: 'tenureStep',
      position: { x: 0, y: 0 },
      data: { kind: step.kind, params }
    })
    if (prev) {
      edges.push(orderEdge(prev, id))
    }
    prev = id
  }
  return { nodes: layoutGraph(nodes, edges), edges }
}

/** Steps in run order: follow next → prev edges from the step nobody points at. */
export function orderSteps(
  nodes: WorkflowNode[],
  edges: Edge[]
): {
  steps: StepNode[]
  problem: 'none' | 'empty' | 'split' | 'loop'
} {
  const steps = nodes.filter(isStepNode)
  if (steps.length === 0) {
    return { steps, problem: 'empty' }
  }
  const byId = new Map(steps.map((s) => [s.id, s]))
  const next = new Map<string, string>()
  const hasPrev = new Set<string>()
  for (const e of edges) {
    if (e.sourceHandle === NEXT_HANDLE && byId.has(e.source) && byId.has(e.target)) {
      next.set(e.source, e.target)
      hasPrev.add(e.target)
    }
  }
  const heads = steps.filter((s) => !hasPrev.has(s.id))
  if (heads.length !== 1) {
    const fallback = [...steps].sort((a, b) => a.position.x - b.position.x)
    return { steps: fallback, problem: heads.length === 0 ? 'loop' : 'split' }
  }
  const ordered: StepNode[] = []
  const seen = new Set<string>()
  for (let cur: string | undefined = heads[0].id; cur && !seen.has(cur); cur = next.get(cur)) {
    seen.add(cur)
    ordered.push(byId.get(cur)!)
  }
  return { steps: ordered, problem: ordered.length === steps.length ? 'none' : 'split' }
}

export function fromGraph(
  nodes: WorkflowNode[],
  edges: Edge[],
  meta: { name: string; description: string }
): { def: WorkflowDef; problem: 'none' | 'empty' | 'split' | 'loop' } {
  const roles: Record<string, RoleDef> = {}
  for (const node of nodes.filter(isRoleNode)) {
    roles[node.data.name] = node.data.def
  }
  const { steps, problem } = orderSteps(nodes, edges)
  const roleOf = new Map(nodes.filter(isRoleNode).map((n) => [n.id, n.data.name]))
  const defSteps = steps.map((step) => {
    const out: StepDef = { kind: step.data.kind, ...step.data.params }
    for (const slot of STEP_SLOTS[step.data.kind]) {
      const names = edges
        .filter((e) => e.target === step.id && e.targetHandle === slot.key)
        .map((e) => roleOf.get(e.source))
        .filter((n): n is string => !!n)
      if (names.length > 0) {
        out[slot.key] = SINGLE_SLOTS.has(slot.key) ? names[0] : names
      }
    }
    return out
  })
  return { def: { ...meta, roles, steps: defSteps }, problem }
}

const STEP_GAP_X = 340
const ROLE_GAP_X = 190
const ROLE_TOP_Y = 260
const ROLE_GAP_Y = 110

/**
 * Auto-tidy: steps left → right in run order; each role sits in a row under the first step that
 * uses it, and a step widens to fit its roles so no line runs through a node.
 */
export function layoutGraph(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  const { steps } = orderSteps(nodes, edges)
  const roles = nodes.filter(isRoleNode)
  const firstUse = new Map<string, string>()
  for (const role of roles) {
    const step = steps.find((s) => edges.some((e) => e.source === role.id && e.target === s.id))
    if (step) {
      firstUse.set(role.id, step.id)
    }
  }
  const pos = new Map<string, { x: number; y: number }>()
  let cursor = 0
  for (const step of steps) {
    pos.set(step.id, { x: cursor, y: 0 })
    const mine = roles.filter((r) => firstUse.get(r.id) === step.id)
    mine.forEach((r, k) => pos.set(r.id, { x: cursor + k * ROLE_GAP_X, y: ROLE_TOP_Y }))
    cursor += Math.max(STEP_GAP_X, mine.length * ROLE_GAP_X)
  }
  roles
    .filter((r) => !firstUse.has(r.id))
    .forEach((r, k) => pos.set(r.id, { x: -ROLE_GAP_X - 60, y: k * ROLE_GAP_Y }))
  return nodes.map((node) => ({ ...node, position: pos.get(node.id) ?? node.position }))
}

/** A role slot that takes one name keeps only its newest edge. */
export function slotMax(kind: StepKind, slot: string): number {
  return STEP_SLOTS[kind].find((s) => s.key === slot)?.max ?? 1
}

/** Required role slots left empty, so the editor can say which dot to connect before the engine check. */
export function emptySlots(def: WorkflowDef): { index: number; kind: StepKind; slot: string }[] {
  const out: { index: number; kind: StepKind; slot: string }[] = []
  def.steps.forEach((step, i) => {
    for (const slot of STEP_SLOTS[step.kind]) {
      if (slot.min > 0 && step[slot.key] === undefined) {
        out.push({ index: i + 1, kind: step.kind, slot: slot.key })
      }
    }
  })
  return out
}
