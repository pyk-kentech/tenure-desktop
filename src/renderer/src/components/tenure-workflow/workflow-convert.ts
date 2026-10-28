import type { Edge } from '@xyflow/react'
import { headSteps, layoutGraph } from './workflow-layout'
import {
  CONTROL_KINDS,
  FORK_HANDLE,
  NEXT_HANDLE,
  NO_HANDLE,
  ROUTE_KEYS,
  SINGLE_SLOTS,
  SLOT_KEYS,
  STEP_SLOTS,
  YES_HANDLE,
  flowEdge,
  isFlowEdge,
  isRoleNode,
  isStepNode,
  newStepNodeId,
  roleNodeId,
  slotEdge,
  type RoleDef,
  type StepDef,
  type StepKind,
  type StepNode,
  type WorkflowDef,
  type WorkflowNode
} from './workflow-model'

// tenure: engine workflow ⇄ editor graph (DESIGN.md 36.29 M44, 36.30 M45). The engine validates.

const END = 'end'
const ID_RE = /^[a-z][a-z0-9_]{0,23}$/
export type GraphProblem = 'none' | 'empty' | 'split' | 'loop' | 'start'

export function isGraphDef(def: WorkflowDef): boolean {
  return def.steps.some((s) => CONTROL_KINDS.includes(s.kind) || 'next' in s || 'max_visits' in s)
}

export function toGraph(def: WorkflowDef): { nodes: WorkflowNode[]; edges: Edge[] } {
  const nodes: WorkflowNode[] = Object.entries(def.roles).map(([name, role]) => ({
    id: roleNodeId(name),
    type: 'tenureRole',
    position: { x: 0, y: 0 },
    data: { name, def: role }
  }))
  const edges: Edge[] = []
  const nodeOf = new Map<string, string>()
  const ids = def.steps.map(() => newStepNodeId())
  def.steps.forEach((step, i) => {
    nodeOf.set(step.id ?? step.kind, ids[i])
    const params: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(step)) {
      if (key === 'kind' || ROUTE_KEYS.has(key)) {
        continue
      }
      if (SLOT_KEYS.has(key) && STEP_SLOTS[step.kind].some((s) => s.key === key)) {
        for (const name of Array.isArray(value) ? value : [value]) {
          if (typeof name === 'string' && def.roles[name]) {
            edges.push(slotEdge(name, ids[i], key))
          }
        }
      } else {
        params[key] = value
      }
    }
    nodes.push({
      id: ids[i],
      type: 'tenureStep',
      position: { x: 0, y: 0 },
      data: { kind: step.kind, params }
    })
  })
  const owned = new Set(def.steps.flatMap((s) => (s.kind === 'parallel' ? asList(s.branches) : [])))
  const link = (from: string, target: unknown, handle: string) => {
    const to = typeof target === 'string' ? nodeOf.get(target) : undefined
    if (to) {
      edges.push(flowEdge(from, to, handle))
    }
  }
  def.steps.forEach((step, i) => {
    if (owned.has(step.id ?? step.kind)) {
      return
    }
    if (step.kind === 'branch') {
      link(ids[i], step.yes, YES_HANDLE)
      link(ids[i], step.no, NO_HANDLE)
      return
    }
    const fallback = def.steps.slice(i + 1).find((s) => !owned.has(s.id ?? s.kind))
    link(ids[i], 'next' in step ? step.next : (fallback?.id ?? fallback?.kind), NEXT_HANDLE)
    if (step.kind === 'parallel') {
      asList(step.branches).forEach((b) => link(ids[i], b, FORK_HANDLE))
    }
  })
  return { nodes: layoutGraph(nodes, edges), edges }
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Steps reachable from the single start, breadth-first; problem says why the walk is not clean. */
export function walkSteps(
  nodes: WorkflowNode[],
  edges: Edge[]
): { steps: StepNode[]; problem: GraphProblem } {
  const steps = nodes.filter(isStepNode)
  if (steps.length === 0) {
    return { steps, problem: 'empty' }
  }
  const heads = headSteps(nodes, edges)
  const byId = new Map(steps.map((s) => [s.id, s]))
  const flow = edges.filter(isFlowEdge)
  const start = heads[0] ?? steps[0]
  const seen = [start.id]
  for (let i = 0; i < seen.length; i++) {
    for (const e of flow.filter((f) => f.source === seen[i])) {
      if (byId.has(e.target) && !seen.includes(e.target)) {
        seen.push(e.target)
      }
    }
  }
  const walked = seen.map((id) => byId.get(id)!)
  const rest = steps.filter((s) => !seen.includes(s.id)).sort((a, b) => a.position.x - b.position.x)
  const problem: GraphProblem =
    heads.length === 0 ? 'loop' : heads.length > 1 ? 'start' : rest.length ? 'split' : 'none'
  return { steps: [...walked, ...rest], problem }
}

/** One plain line (no control steps, no merges, no loops): saved in the old list form. */
function isPlainLine(steps: StepNode[], edges: Edge[]): boolean {
  if (
    steps.some((s) => CONTROL_KINDS.includes(s.data.kind) || s.data.params.max_visits !== undefined)
  ) {
    return false
  }
  const flow = edges.filter(isFlowEdge)
  const ins = new Map<string, number>()
  flow.forEach((e) => ins.set(e.target, (ins.get(e.target) ?? 0) + 1))
  return steps.every((s, i) => {
    const out = flow.filter((e) => e.source === s.id)
    const next = steps[i + 1]
    return (
      (ins.get(s.id) ?? 0) <= 1 &&
      (next ? out.length === 1 && out[0].target === next.id : out.length === 0)
    )
  })
}

export function fromGraph(
  nodes: WorkflowNode[],
  edges: Edge[],
  meta: { name: string; description: string }
): { def: WorkflowDef; problem: GraphProblem } {
  const roles: Record<string, RoleDef> = {}
  for (const node of nodes.filter(isRoleNode)) {
    roles[node.data.name] = node.data.def
  }
  const roleOf = new Map(nodes.filter(isRoleNode).map((n) => [n.id, n.data.name]))
  const { steps, problem } = walkSteps(nodes, edges)
  const plain = problem === 'none' && isPlainLine(steps, edges)
  const idOf = assignIds(steps)
  const outs = (s: StepNode, handle: string) =>
    edges
      .filter((e) => e.source === s.id && e.sourceHandle === handle)
      .map((e) => idOf.get(e.target))
  const owned = new Set(edges.filter((e) => e.sourceHandle === FORK_HANDLE).map((e) => e.target))
  const defSteps = steps.map((step) => {
    const { id: _ignored, ...params } = step.data.params
    const out: StepDef = { kind: step.data.kind, id: idOf.get(step.id), ...params }
    for (const slot of STEP_SLOTS[step.data.kind]) {
      const names = edges
        .filter((e) => e.target === step.id && e.targetHandle === slot.key)
        .map((e) => roleOf.get(e.source))
        .filter((n): n is string => !!n)
      if (names.length > 0) {
        out[slot.key] = SINGLE_SLOTS.has(slot.key) ? names[0] : names
      }
    }
    if (plain || owned.has(step.id)) {
      return out
    }
    if (step.data.kind === 'branch') {
      out.yes = outs(step, YES_HANDLE)[0] ?? END
      out.no = outs(step, NO_HANDLE)[0] ?? END
    } else {
      out.next = outs(step, NEXT_HANDLE)[0] ?? END
    }
    if (step.data.kind === 'parallel') {
      out.branches = outs(step, FORK_HANDLE).filter(Boolean)
    }
    return out
  })
  return { def: { ...meta, roles, steps: defSteps }, problem: plain ? 'none' : problem }
}

/** Engine step ids: keep a valid one the user gave, otherwise kind, kind2, … (unique). */
function assignIds(steps: StepNode[]): Map<string, string> {
  const taken = new Set<string>()
  const out = new Map<string, string>()
  const want = (s: StepNode) => {
    const given = s.data.params.id
    return typeof given === 'string' && ID_RE.test(given) ? given : s.data.kind
  }
  for (const s of steps) {
    let id = want(s)
    for (let n = 2; taken.has(id); n++) {
      id = `${want(s)}${n}`
    }
    taken.add(id)
    out.set(s.id, id)
  }
  return out
}

/** Required role slots left empty, so the editor can say which dot to connect first. */
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

/** The only step with no way out (new steps join after it), or null when that is ambiguous. */
export function tailStep(nodes: WorkflowNode[], edges: Edge[]): StepNode | null {
  const flow = edges.filter(isFlowEdge)
  const tails = nodes
    .filter(isStepNode)
    .filter(
      (s) =>
        s.data.kind !== 'branch' &&
        !flow.some((e) => e.source === s.id && e.sourceHandle === NEXT_HANDLE)
    )
    .filter((s) => !flow.some((e) => e.target === s.id && e.sourceHandle === FORK_HANDLE))
  return tails.length === 1 ? tails[0] : null
}
