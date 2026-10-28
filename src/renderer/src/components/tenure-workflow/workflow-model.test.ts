import { describe, expect, it } from 'vitest'
import {
  fromGraph,
  isRoleNode,
  isStepNode,
  layoutGraph,
  orderEdge,
  toGraph,
  type WorkflowDef
} from './workflow-model'

// tenure: graph ⇄ engine workflow for the node editor (DESIGN.md 36.29 M44)
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

describe('workflow graph', () => {
  it('round-trips an engine workflow through the graph', () => {
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
    expect(
      fromGraph(shuffled, edges, { name: 'x', description: '' }).def.steps.map((s) => s.kind)
    ).toEqual(['debate', 'build', 'audit'])
  })

  it('reports a broken line and a loop', () => {
    const { nodes, edges } = toGraph(SECURE)
    const steps = nodes.filter(isStepNode)
    const unlinked = edges.filter((e) => !e.animated)
    expect(fromGraph(nodes, unlinked, { name: 'x', description: '' }).problem).toBe('split')
    const loop = [...edges, orderEdge(steps[2].id, steps[0].id)]
    expect(fromGraph(nodes, loop, { name: 'x', description: '' }).problem).toBe('loop')
  })

  it('lays steps out left to right and roles in a row under the step that first uses them', () => {
    const { nodes, edges } = toGraph(SECURE)
    const laid = layoutGraph(nodes, edges)
    const steps = laid.filter(isStepNode)
    expect(steps.map((s) => s.position.x)).toEqual([0, 380, 720])
    const security = laid.find((n) => n.id === 'role:security')!
    expect(security.position.x).toBe(380)
    expect(security.position.y).toBeGreaterThan(0)
  })
})
