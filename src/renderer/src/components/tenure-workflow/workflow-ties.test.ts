import { describe, expect, it } from 'vitest'
import { fromGraph, toGraph } from './workflow-convert'
import type { WorkflowDef } from './workflow-model'
import {
  crossedLines,
  cutTies,
  liveTies,
  tieFromCut,
  tieRoutes,
  viaPath,
  type Tie
} from './workflow-ties'

// tenure: cable ties and the saved editor layout (DESIGN.md 36.34)

const DEF: WorkflowDef = {
  name: 't',
  description: '',
  roles: { claude: { agent: 'claude' }, codex: { agent: 'codex' } },
  steps: [
    { kind: 'debate', proposers: ['claude', 'codex'], synth: 'codex' },
    { kind: 'build', implementer: 'claude', reviewers: ['codex'] }
  ],
  editor: {
    nodes: { 'role:claude': [-300, 10], 'step:2': [500, 40] },
    ties: [
      {
        x: 100,
        y: 50,
        angle: 0,
        wires: ['role:claude/out>step:2/implementer', 'role:codex/out>step:2/reviewers', 'bad']
      }
    ]
  }
}

describe('saved editor layout', () => {
  it('places saved nodes, ties known lines, and saves both back', () => {
    const { nodes, edges, ties } = toGraph(DEF)
    expect(nodes.find((n) => n.id === 'role:claude')?.position).toEqual({ x: -300, y: 10 })
    expect(ties).toHaveLength(1)
    expect(ties[0].edges).toHaveLength(2)
    const { def } = fromGraph(nodes, edges, { name: 't', description: '' }, ties)
    expect(def.editor?.nodes?.['step:2']).toEqual([500, 40])
    expect(def.editor?.nodes?.['step:1']).toBeDefined()
    expect(def.editor?.ties).toEqual([
      {
        x: 100,
        y: 50,
        angle: 0,
        wires: ['role:claude/out>step:2/implementer', 'role:codex/out>step:2/reviewers']
      }
    ])
  })

  it('leaves the definition alone without ties (no editor table)', () => {
    const { nodes, edges } = toGraph({ ...DEF, editor: undefined })
    expect(fromGraph(nodes, edges, { name: 't', description: '' }).def.editor).toBeUndefined()
  })

  it('drops removed lines and empty ties', () => {
    const tie: Tie = { id: 'a', x: 0, y: 0, angle: 0, edges: ['x', 'y'] }
    const edges = [{ id: 'y', source: 'a', target: 'b' }]
    expect(liveTies([tie], edges)).toEqual([{ ...tie, edges: ['y'] }])
    expect(liveTies([tie], [])).toEqual([])
  })
})

describe('cutting and routing', () => {
  const lines = new Map([
    [
      'top',
      [
        { x: 0, y: 0 },
        { x: 200, y: 0 }
      ]
    ],
    [
      'low',
      [
        { x: 0, y: 40 },
        { x: 200, y: 40 }
      ]
    ]
  ])

  it('a vertical cut ties the crossed lines in order, lines passing left to right', () => {
    const p = { x: 100, y: -20 }
    const q = { x: 100, y: 60 }
    const crossed = crossedLines(p, q, lines)
    expect(crossed.map((c) => c.id)).toEqual(['top', 'low'])
    const tie = tieFromCut(p, q, crossed)!
    expect(tie.angle).toBe(0)
    expect(tie.x).toBeCloseTo(100)
    expect(tie.y).toBeCloseTo(20)
    expect(tie.edges).toEqual(['top', 'low'])
    // Why: the strands sit 6px apart around the tie centre, top line above.
    const routes = tieRoutes([tie])
    expect(routes.get('top')?.[0].y).toBeCloseTo(17)
    expect(routes.get('low')?.[0].y).toBeCloseTo(23)
    // Cutting back up keeps the same order on screen.
    expect(tieFromCut(q, p, crossedLines(q, p, lines))!.edges).toEqual(['top', 'low'])
  })

  it('a cut that misses every line makes no tie, and a cut over a tie finds it', () => {
    expect(tieFromCut({ x: 0, y: 100 }, { x: 50, y: 120 }, [])).toBeNull()
    const tie: Tie = { id: 't', x: 100, y: 20, angle: 0, edges: ['top', 'low'] }
    expect(cutTies({ x: 80, y: 20 }, { x: 120, y: 20 }, [tie])).toHaveLength(1)
    expect(cutTies({ x: 80, y: 90 }, { x: 120, y: 90 }, [tie])).toHaveLength(0)
  })

  it('a path goes through every via, ordered along the line', () => {
    const path = viaPath({ x: 0, y: 0 }, { x: 300, y: 0 }, [
      { x: 200, y: 30, dx: 1, dy: 0 },
      { x: 100, y: 30, dx: 1, dy: 0 }
    ])
    const ends = [...path.matchAll(/, (-?[\d.]+) (-?[\d.]+)(?= C|$)/g)].map((m) => [
      Number(m[1]),
      Number(m[2])
    ])
    expect(ends).toEqual([
      [100, 30],
      [200, 30],
      [300, 0]
    ])
  })
})
