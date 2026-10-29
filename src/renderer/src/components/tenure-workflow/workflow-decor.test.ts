import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import {
  boxAround,
  followBends,
  followTies,
  groupMembers,
  lineRoutes,
  type Bend
} from './workflow-decor'
import { viaPath, type Tie } from './workflow-ties'
import type { WorkflowNode } from './workflow-model'

// tenure: bend points, group boxes and ties following moved nodes (DESIGN.md 36.39)

const EDGES: Edge[] = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'c' }
]

function node(id: string, x: number, y: number): WorkflowNode {
  return {
    id,
    type: 'tenureRole',
    position: { x, y },
    measured: { width: 100, height: 40 },
    data: { name: id, def: { agent: 'claude' } }
  } as WorkflowNode
}

describe('following moved nodes', () => {
  it('moves a tie by the average shift of its lines and a bend by its line', () => {
    const tie: Tie = { id: 't', x: 0, y: 0, angle: 0, edges: ['e1', 'e2'] }
    const bend: Bend = { id: 'b', edge: 'e1', x: 10, y: 10 }
    // Why: moving both ends of a line moves its middle fully; one end, half.
    const moved = new Map([
      ['a', { x: 20, y: 0 }],
      ['b', { x: 20, y: 0 }]
    ])
    expect(followTies([tie], EDGES, moved)[0]).toMatchObject({ x: 15, y: 0 })
    expect(followBends([bend], EDGES, moved)[0]).toMatchObject({ x: 30, y: 10 })
    expect(followTies([tie], EDGES, new Map([['z', { x: 5, y: 5 }]]))[0]).toBe(tie)
  })
})

describe('group boxes', () => {
  it('boxes nodes with room for the title and finds the nodes inside', () => {
    const nodes = [node('a', 0, 0), node('b', 300, 100), node('c', 900, 900)]
    const g = boxAround(nodes.slice(0, 2), { x: 0, y: 0 }, 'G')
    expect(g).toMatchObject({ title: 'G', x: -24, y: -52, w: 448, h: 216 })
    expect(groupMembers(g, nodes)).toEqual(['a', 'b'])
    expect(boxAround([], { x: 5, y: 6 }, '')).toMatchObject({ x: 5, y: 6, w: 360, h: 220 })
  })
})

describe('bend routing', () => {
  it('passes a line through its bend points in order', () => {
    const routes = lineRoutes(new Map(), [
      { id: 'b2', edge: 'e1', x: 200, y: 50 },
      { id: 'b1', edge: 'e1', x: 100, y: -50 }
    ])
    const vias = routes.get('e1') ?? []
    const path = viaPath({ x: 0, y: 0 }, { x: 300, y: 0 }, vias)
    // Why: sorted along the line, each bend is an end point of one curve segment.
    expect(path.match(/C [^C]*/g)?.map((seg) => seg.trim().split(' ').slice(-2).join(' '))).toEqual(
      ['100 -50', '200 50', '300 0']
    )
  })
})
