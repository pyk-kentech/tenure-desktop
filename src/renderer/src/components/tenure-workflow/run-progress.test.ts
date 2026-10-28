import { describe, expect, it } from 'vitest'
import { runProgress, type RunStateLike } from './run-progress'
import { displayGraph, stepRefs } from './graph-display'
import { toGraph } from './workflow-convert'
import type { WorkflowDef } from './workflow-model'

// tenure: run view progress (DESIGN.md 36.32), from the state of a real mock run of rescue-demo.
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

const DONE_STATE: RunStateLike = {
  status: 'done_approved',
  done: [
    'build:base',
    'impl:1',
    'review:1',
    'build',
    'impl:2',
    'review:2',
    'impl:3',
    'review:3',
    'continue:rescue',
    'audit:a2',
    'audit:a1',
    'report'
  ],
  review_history: [
    { round: 1, approved: false, blocking: 1 },
    { round: 2, approved: false, blocking: 1 },
    { round: 3, approved: true, blocking: 0 }
  ],
  audits: { a1: [{ role: 'aud', approved: true }], a2: [{ role: 'dev', approved: true }] },
  graph: { decisions: { 'ok#1': 'no', 'ok#2': 'yes' }, continue: { rescue: 3 } }
}

describe('run progress', () => {
  it('splits review rounds between the build and the additional fixes by done order', () => {
    const { nodes, edges } = toGraph(RESCUE)
    const p = runProgress(stepRefs(nodes, edges), DONE_STATE, false, null)
    expect(p.get('build')).toMatchObject({ status: 'done' })
    expect(p.get('build')!.lines).toHaveLength(1)
    expect(p.get('rescue')!.status).toBe('done')
    expect(p.get('rescue')!.lines).toHaveLength(3)
    expect(p.get('ok')!.lines).toHaveLength(2)
    expect(p.get('checks')!.status).toBe('done')
    expect(p.get('a1')!.lines).toEqual([expect.stringContaining('aud')])
  })

  it('marks the running step and steps a finished run never reached', () => {
    const { nodes, edges } = toGraph(RESCUE)
    const live: RunStateLike = { status: 'running', phase: 'build', done: ['build:base', 'impl:1'] }
    const call = { agent: 'rev', step: 'review', elapsed_sec: 12.4 }
    const p = runProgress(stepRefs(nodes, edges), live, true, call)
    expect(p.get('build')!.status).toBe('running')
    expect(p.get('build')!.lines.at(-1)).toContain('12')
    expect(p.get('a1')!.status).toBe('pending')
    const stopped = runProgress(stepRefs(nodes, edges), { ...live, status: 'failed' }, false, null)
    expect(stopped.get('build')!.status).toBe('failed')
    expect(stopped.get('a1')!.status).toBe('skipped')
  })

  it('lights only the lines the run took and colours role lines by agent', () => {
    const { nodes, edges } = toGraph(RESCUE)
    const p = runProgress(stepRefs(nodes, edges), DONE_STATE, false, null)
    const shown = displayGraph(nodes, edges, p, DONE_STATE.graph?.decisions)
    const roleLine = shown.edges.find((e) => e.source === 'role:dev')!
    expect(roleLine).toMatchObject({ type: 'tenureRole', data: { color: '#D85A30' } })
    const flow = shown.edges.filter((e) => e.type !== 'tenureRole')
    expect(flow.every((e) => !(e.data as { dim?: boolean }).dim)).toBe(true)
    const unseen = runProgress(stepRefs(nodes, edges), { status: 'running', done: [] }, true, null)
    const quiet = displayGraph(nodes, edges, unseen, {})
    expect(
      quiet.edges
        .filter((e) => e.type !== 'tenureRole')
        .every((e) => (e.data as { dim?: boolean }).dim)
    ).toBe(true)
  })
})
