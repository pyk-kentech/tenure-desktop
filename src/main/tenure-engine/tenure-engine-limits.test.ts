import { describe, expect, it } from 'vitest'
import { parseTenureLimits } from './tenure-engine-limits'

describe('parseTenureLimits', () => {
  it('maps engine /api/limits into the shell shape', () => {
    const limits = parseTenureLimits({
      codex: {
        primary: { used_percent: 29, resets_at: 1792700000 },
        secondary: { used_percent: 80 }
      },
      claude: {
        as_of: '2026-10-22T22:59:00',
        limits: { five_hour: { used_percent: 60, resets_at: '2026-10-23T03:00:00' } }
      },
      slots: { busy: 1, max: 8 }
    })
    expect(limits.slots).toEqual({ busy: 1, max: 8 })
    expect(limits.codex.fiveHour?.usedPercent).toBe(29)
    expect(limits.codex.fiveHour?.resetsAt).toBe(new Date(1792700000 * 1000).toISOString())
    expect(limits.codex.week).toEqual({ usedPercent: 80, resetsAt: null })
    expect(limits.claude.fiveHour).toEqual({ usedPercent: 60, resetsAt: '2026-10-23T03:00:00' })
    expect(limits.claude.week).toBeNull()
  })

  it('treats unknown engine output as unknown, not zero', () => {
    const limits = parseTenureLimits({ codex: null, claude: null })
    expect(limits).toEqual({
      slots: null,
      claude: { fiveHour: null, week: null },
      codex: { fiveHour: null, week: null }
    })
  })
})
