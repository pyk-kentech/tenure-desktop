import { describe, expect, it } from 'vitest'
import { buildQuickComposerStartup } from './quick-startup-plan'
import {
  DEFAULT_TENURE_RELAY_OPTIONS,
  TENURE_RELAY_MAX_ROUNDS_ENV
} from '../../../../shared/tenure-relay'

const base = {
  prompt: '할일 CLI 만들기',
  draftPrompt: null,
  settings: null,
  launchHost: { kind: 'known', platform: 'win32', hostKind: 'local' } as never,
  shell: 'powershell' as const,
  isRemote: false,
  telemetrySource: undefined as never
}

describe('quick composer startup: tenure relay (DESIGN.md 36.24)', () => {
  it('launches the coordinator Codex with its flags, the cap env and the coordinator prompt', () => {
    const { startupPlan, backendStartup } = buildQuickComposerStartup({
      ...base,
      agent: 'codex',
      tenureRelay: { ...DEFAULT_TENURE_RELAY_OPTIONS, coordinatorModel: 'gpt-5.5', maxRounds: 4 }
    })
    expect(startupPlan?.launchCommand).toContain(
      "'-m' 'gpt-5.5' '-c' 'model_reasoning_effort=high'"
    )
    // The worker repeats the user's Codex default args, which the split pane would not get.
    expect(startupPlan?.launchCommand).toContain(
      '[codex --dangerously-bypass-approvals-and-sandbox]'
    )
    // Vitest runs with import.meta.env.DEV, so the dev CLI name is chosen.
    expect(startupPlan?.launchCommand).toContain('orca-dev skills get orchestration')
    expect(startupPlan?.launchCommand).toContain('할일 CLI 만들기')
    expect(startupPlan?.env?.[TENURE_RELAY_MAX_ROUNDS_ENV]).toBe('4')
    expect(backendStartup?.env?.[TENURE_RELAY_MAX_ROUNDS_ENV]).toBe('4')
  })

  it('normalizes the options it is given', () => {
    const { startupPlan } = buildQuickComposerStartup({
      ...base,
      agent: 'codex',
      tenureRelay: { ...DEFAULT_TENURE_RELAY_OPTIONS, maxRounds: 999 }
    })
    expect(startupPlan?.env?.[TENURE_RELAY_MAX_ROUNDS_ENV]).toBe('20')
  })

  it('leaves a plain Codex launch untouched', () => {
    const { startupPlan } = buildQuickComposerStartup({ ...base, agent: 'codex' })
    expect(startupPlan?.launchCommand).not.toContain('orchestration')
    expect(startupPlan?.env?.[TENURE_RELAY_MAX_ROUNDS_ENV]).toBeUndefined()
  })

  it('ignores relay options for an agent other than Codex', () => {
    const { startupPlan } = buildQuickComposerStartup({
      ...base,
      agent: 'claude',
      tenureRelay: DEFAULT_TENURE_RELAY_OPTIONS
    })
    expect(startupPlan?.launchCommand).not.toContain('orchestration')
  })
})
