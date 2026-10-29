import { describe, expect, it } from 'vitest'
import { workflowPreview, workflowTitle } from './workflow-titles'

// tenure: one workflow name everywhere and the start form's preview (DESIGN.md 36.37 M52)

describe('workflow titles', () => {
  it('names built-ins the same everywhere and saved ones by their own name', () => {
    expect(workflowTitle('quick', 'quick')).toBe('Quick')
    expect(workflowTitle('workflow-2', '내 흐름')).toBe('내 흐름')
    expect(workflowTitle('mine', ' ')).toBe('mine')
  })

  it('lists who sits in each slot of each step', () => {
    const lines = workflowPreview(
      [
        { kind: 'explore', role: 'scout' },
        { kind: 'build', implementer: 'claude', reviewers: ['codex', 'security'] },
        { kind: 'mystery' }
      ],
      [
        { name: 'scout', agent: 'codex', model: 'gpt-6-luna' },
        { name: 'claude', agent: 'claude' },
        { name: 'security', agent: 'codex' }
      ]
    )
    expect(lines).toEqual([
      '1. Explore the code — Explorer scout(gpt-6-luna)',
      '2. Implement + review — Implementer claude · Reviewers codex, security(codex)',
      '3. mystery'
    ])
  })
})
