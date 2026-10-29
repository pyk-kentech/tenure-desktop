import type { Edge, Node } from '@xyflow/react'
import type { StepProgress } from './run-progress'

// tenure: engine workflow (src/tenure/workflow.py) as a node graph (DESIGN.md 36.29 M44, 36.30 M45).
// Types, step slots and edge helpers; conversion lives in workflow-convert.ts, layout in workflow-layout.ts.

export type StepKind = 'explore' | 'debate' | 'build' | 'audit' | 'branch' | 'continue' | 'parallel'
export const BLOCK_KINDS: StepKind[] = ['explore', 'debate', 'build', 'audit']
export const CONTROL_KINDS: StepKind[] = ['branch', 'continue', 'parallel']
// Steps that may run more than once in a loop (the engine refuses max_visits on debate/build).
export const REVISIT_KINDS = new Set<StepKind>([
  'explore',
  'audit',
  'branch',
  'continue',
  'parallel'
])
// Read-only steps a parallel node can run side by side.
export const PARALLEL_BRANCH_KINDS = new Set<StepKind>(['explore', 'audit'])
export const BRANCH_CHECKS = ['approved', 'tests_pass', 'audit_clean'] as const

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
  audit: [{ key: 'roles', min: 1, max: 3 }],
  branch: [],
  continue: [
    { key: 'implementer', min: 1, max: 1 },
    { key: 'reviewers', min: 1, max: 3 }
  ],
  parallel: []
}
// Slots the engine stores as one role name rather than a list.
export const SINGLE_SLOTS = new Set(['role', 'synth', 'implementer', 'arbiter'])
export const SLOT_KEYS = new Set(
  Object.values(STEP_SLOTS).flatMap((slots) => slots.map((s) => s.key))
)
// Route keys become edges, never params.
export const ROUTE_KEYS = new Set(['next', 'yes', 'no', 'branches'])

// sockets: connected connector id → line colour, filled in by graph-display (DESIGN.md 36.32)
export type RoleNodeData = { name: string; def: RoleDef; sockets?: Record<string, string> }
// progress is set only in the run view (DESIGN.md 36.32)
export type StepNodeData = {
  kind: StepKind
  params: Record<string, unknown>
  progress?: StepProgress
  sockets?: Record<string, string>
  // view state only, never saved (DESIGN.md 36.33)
  collapsed?: boolean
}
export type RoleNode = Node<RoleNodeData, 'tenureRole'>
export type StepNode = Node<StepNodeData, 'tenureStep'>
export type WorkflowNode = RoleNode | StepNode

export const NEXT_HANDLE = 'next'
export const YES_HANDLE = 'yes'
export const NO_HANDLE = 'no'
export const FORK_HANDLE = 'fork'
export const PREV_HANDLE = 'prev'
export const ROLE_HANDLE = 'out'
export const FLOW_HANDLES = new Set([NEXT_HANDLE, YES_HANDLE, NO_HANDLE, FORK_HANDLE])
export const MAX_PARALLEL = 4
// Agent colours for role headers, role connectors and role lines (DESIGN.md 36.32).
export const AGENT_COLOR: Record<string, string> = { claude: '#D85A30', codex: '#1D9E75' }
// Run-order connector colours by output kind.
export const OUTPUT_COLOR: Record<string, string> = {
  next: '#a1a1aa',
  yes: '#10b981',
  no: '#f43f5e',
  fork: '#0ea5e9'
}

/** Output dots a step has on its right side, in drawing order. */
export function flowOutputs(kind: StepKind): string[] {
  if (kind === 'branch') {
    return [YES_HANDLE, NO_HANDLE]
  }
  if (kind === 'parallel') {
    return [FORK_HANDLE, NEXT_HANDLE]
  }
  return [NEXT_HANDLE]
}

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
    type: 'tenureRole'
  }
}

/** A run-order edge from a step's output dot (next / yes / no / fork) to another step. */
export function flowEdge(from: string, to: string, handle: string = NEXT_HANDLE): Edge {
  return {
    id: `${from}:${handle}->${to}`,
    source: from,
    sourceHandle: handle,
    target: to,
    targetHandle: PREV_HANDLE,
    type: 'tenureFlow'
  }
}

/** Kept for M44 callers: a plain next edge. */
export function orderEdge(from: string, to: string): Edge {
  return flowEdge(from, to, NEXT_HANDLE)
}

export function isFlowEdge(e: Edge): boolean {
  return !!e.sourceHandle && FLOW_HANDLES.has(e.sourceHandle)
}

export function slotMax(kind: StepKind, slot: string): number {
  return STEP_SLOTS[kind].find((s) => s.key === slot)?.max ?? 1
}
