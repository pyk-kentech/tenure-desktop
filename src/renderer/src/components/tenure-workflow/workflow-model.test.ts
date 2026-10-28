import { describe, expect, it } from 'vitest'
import { fromGraph, toGraph } from './workflow-convert'
import { layoutGraph } from './workflow-layout'
import {
  FORK_HANDLE,
  flowEdge,
  isFlowEdge,
  isRoleNode,
  isStepNode,
  type WorkflowDef
} from './workflow-model'

// tenure: graph ⇄ engine workflow for the node editor (DESIGN.md 36.29 M44, 36.30 M45)
const SECURE: WorkflowDef = {
  name: 'secure',
  description: 'debate → build + security review → audit',
  roles: {
    claude: { agent: 'claude' },
    codex: { agent: 'codex' },
    security: { agent: 'codex', templates: { review: 'review_security' } }
  },
  steps: [
    { kind: 'debate', id: 'debate', proposers: ['claude', 'codex'], synth: 'codex' },
    {
      kind: 'build',
      id: 'build',
      implementer: 'claude',
      reviewers: ['codex', 'security'],
      max_review: 2
    },
    { kind: 'audit', id: 'audit', roles: ['claude'] }
  ]
}

const RESCUE: WorkflowDef = {
  name: 'rescue',
  description: '',
  roles: { dev: { agent: 'claude' }, rev: { agent: 'codex' }, aud: { agent: 'claude' } },
  steps: [
    { kind: 'build', id: 'build', implementer: 'dev', reviewers: ['rev'] },
    { kind: 'branch', id: 'ok', check: 'approved', yes: 'checks', no: 'rescue', max_visits: 2 },
    {
      kind: 'continue',
      id: 'rescue',
      implementer: 'rev',
      reviewers: ['aud'],
      rounds: 2,
      next: 'ok'
    },
    { kind: 'parallel', id: 'checks', branches: ['a1', 'a2'], next: 'end' },
    { kind: 'audit', id: 'a1', roles: ['aud'] },
    { kind: 'audit', id: 'a2', roles: ['dev'] }
  ]
}

const meta = { name: 'x', description: '' }

describe('workflow graph', () => {
  it('round-trips a one-line workflow in the old list form', () => {
    const { nodes, edges } = toGraph(SECURE)
    expect(nodes.filter(isRoleNode)).toHaveLength(3)
    expect(nodes.filter(isStepNode)).toHaveLength(3)
    const { def, problem } = fromGraph(nodes, edges, {
      name: 'secure',
      description: SECURE.description
    })
    expect(problem).toBe('none')
    expect(def).toEqual(SECURE)
  })

  it('orders steps by their links, not by where they sit', () => {
    const { nodes, edges } = toGraph(SECURE)
    const shuffled = nodes.map((n) =>
      isStepNode(n) ? { ...n, position: { x: -n.position.x, y: 0 } } : n
    )
    expect(fromGraph(shuffled, edges, meta).def.steps.map((s) => s.kind)).toEqual([
      'debate',
      'build',
      'audit'
    ])
  })

  it('reports several starts and a missing start', () => {
    const { nodes, edges } = toGraph(SECURE)
    const steps = nodes.filter(isStepNode)
    expect(
      fromGraph(
        nodes,
        edges.filter((e) => !isFlowEdge(e)),
        meta
      ).problem
    ).toBe('start')
    const loop = [...edges, flowEdge(steps[2].id, steps[0].id)]
    expect(fromGraph(nodes, loop, meta).problem).toBe('loop')
  })

  it('puts roles in a left column by first use and steps left to right', () => {
    const { nodes, edges } = toGraph(SECURE)
    const laid = layoutGraph(nodes, edges)
    expect(laid.filter(isStepNode).map((s) => s.position.x)).toEqual([240, 540, 840])
    const y = (id: string) => laid.find((n) => n.id === id)!.position
    expect(y('role:claude')).toEqual({ x: 0, y: 0 })
    expect(y('role:security').x).toBe(0)
    expect(y('role:security').y).toBeGreaterThan(y('role:codex').y)
  })

  it('round-trips branches, a loop back and side-by-side audits in the graph form', () => {
    const { nodes, edges } = toGraph(RESCUE)
    expect(edges.filter((e) => e.sourceHandle === FORK_HANDLE)).toHaveLength(2)
    const { def, problem } = fromGraph(nodes, edges, meta)
    expect(problem).toBe('none')
    const byId = Object.fromEntries(def.steps.map((s) => [s.id, s]))
    expect(def.steps[0].id).toBe('build')
    expect(byId.build.next).toBe('ok')
    expect(byId.ok).toMatchObject({ yes: 'checks', no: 'rescue', check: 'approved', max_visits: 2 })
    expect(byId.rescue).toMatchObject({
      next: 'ok',
      implementer: 'rev',
      reviewers: ['aud'],
      rounds: 2
    })
    expect(byId.checks).toMatchObject({ branches: ['a1', 'a2'], next: 'end' })
    expect(byId.a1).toEqual({ kind: 'audit', id: 'a1', roles: ['aud'] })
  })

  it('stacks the yes and no lanes of a branch in one column', () => {
    const { nodes, edges } = toGraph(RESCUE)
    const laid = layoutGraph(nodes, edges).filter(isStepNode)
    const at = (id: string) => laid.find((n) => n.data.params.id === id)!.position
    expect(at('checks').x).toBe(at('rescue').x)
    expect(at('checks').y).not.toBe(at('rescue').y)
    expect(at('ok').x).toBeGreaterThan(at('build').x)
  })
})
