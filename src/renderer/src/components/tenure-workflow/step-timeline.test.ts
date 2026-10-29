import { describe, expect, it } from 'vitest'
import { clock, secondsSince, stepSeconds, stepTimelines, type RunEvent } from './step-timeline'

// tenure: live per-step detail from run events (DESIGN.md 36.35)

const STEPS = [
  { id: 'debate', kind: 'debate' as const },
  { id: 'build', kind: 'build' as const },
  { id: 'a1', kind: 'audit' as const },
  { id: 'a2', kind: 'audit' as const }
]

let seq = 0
function ev(kind: string, extra: Partial<RunEvent>): RunEvent {
  seq += 1
  return { seq, ts: '2026-10-28T10:00:00', kind, ...extra }
}

describe('step timelines', () => {
  it('groups calls and logs by their tagged step, pairing starts with ends', () => {
    const events = [
      ev('step_start', {
        role: 'dev',
        agent: 'claude',
        step: 'implement',
        round: 1,
        wf_step: 'build'
      }),
      ev('log', { text: 'implementing', wf_step: 'build' }),
      ev('step_start', { role: 'aud1', agent: 'claude', step: 'audit', wf_step: 'a1' }),
      ev('step_start', { role: 'aud2', agent: 'codex', step: 'audit', wf_step: 'a2' }),
      ev('step_end', { role: 'dev', step: 'implement', round: 1, sec: 42, outcome: 'done' }),
      ev('step_end', { role: 'aud2', step: 'audit', sec: 7, outcome: 'blocked' }),
      ev('log', { text: 'no step' })
    ]
    const t = stepTimelines(events, STEPS)
    expect(t.get('build')?.calls).toMatchObject([
      { role: 'dev', sub: 'implement', round: 1, sec: 42, outcome: 'done' }
    ])
    expect(t.get('build')?.logs.map((l) => l.text)).toEqual(['implementing'])
    // Why: parallel audits keep apart; a1 is still running.
    expect(t.get('a1')?.calls[0].sec).toBeNull()
    expect(t.get('a2')?.calls[0]).toMatchObject({ sec: 7, outcome: 'blocked' })
  })

  it('places untagged calls of older runs by the kind of work', () => {
    const t = stepTimelines(
      [
        ev('step_start', { role: 'claude', step: 'propose' }),
        ev('step_start', { role: 'codex', step: 'review', round: 2 }),
        ev('step_start', { role: 'x', step: 'audit' })
      ],
      STEPS
    )
    expect(t.get('debate')?.calls).toHaveLength(1)
    expect(t.get('build')?.calls[0].round).toBe(2)
    expect(t.get('a1')?.calls).toHaveLength(1)
    expect(t.get('a2')).toBeUndefined()
  })

  it('formats time and counts running calls up to now', () => {
    expect(clock(5)).toBe('0:05')
    expect(clock(125)).toBe('2:05')
    expect(clock(3725)).toBe('1:02:05')
    const now = Date.parse('2026-10-28T10:00:30')
    expect(secondsSince('2026-10-28T10:00:00', now)).toBe(30)
    const t = stepTimelines(
      [
        ev('step_start', { role: 'a', step: 'review', round: 1, wf_step: 'build' }),
        ev('step_end', { role: 'a', step: 'review', round: 1, sec: 10 }),
        ev('step_start', { role: 'b', step: 'fix', round: 1, wf_step: 'build' })
      ],
      STEPS
    )
    expect(stepSeconds(t.get('build')!, now)).toBe(40)
  })
})
