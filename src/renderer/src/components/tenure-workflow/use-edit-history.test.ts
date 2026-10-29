import { describe, expect, it } from 'vitest'
import { editSignature } from './use-edit-history'
import { toGraph } from './workflow-convert'
import type { WorkflowDef, WorkflowNode } from './workflow-model'

// tenure: what the editor's undo and "unsaved changes" count as a change (DESIGN.md 36.36 M51)

const DEF: WorkflowDef = {
  name: 't',
  description: '',
  roles: { claude: { agent: 'claude' }, codex: { agent: 'codex' } },
  steps: [{ kind: 'build', implementer: 'claude', reviewers: ['codex'] }]
}

describe('edit signature', () => {
  it('ignores selection, sub-pixel moves and folding a node', () => {
    const { nodes, edges } = toGraph(DEF)
    const base = editSignature(nodes, edges, [])
    // Why: folding is a step node's view state; the cast keeps the test about the signature only.
    const touched = nodes.map((n, i): WorkflowNode =>
      i === 0
        ? ({
            ...n,
            selected: true,
            position: { x: n.position.x + 0.2, y: n.position.y },
            data: { ...n.data, collapsed: true }
          } as WorkflowNode)
        : n
    )
    expect(
      editSignature(
        touched,
        edges.map((e) => ({ ...e, selected: true })),
        []
      )
    ).toBe(base)
  })

  it('sees moves, settings, lines and ties', () => {
    const { nodes, edges } = toGraph(DEF)
    const base = editSignature(nodes, edges, [])
    const moved = nodes.map((n, i) =>
      i === 0 ? { ...n, position: { x: n.position.x + 40, y: 0 } } : n
    )
    expect(editSignature(moved, edges, [])).not.toBe(base)
    expect(editSignature(nodes, edges.slice(1), [])).not.toBe(base)
    expect(
      editSignature(nodes, edges, [{ id: 't1', x: 0, y: 0, angle: 0, edges: [edges[0].id] }])
    ).not.toBe(base)
  })
})
