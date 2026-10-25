import { describe, expect, it } from 'vitest'
import {
  buildTenureRelayCoordinatorPrompt,
  DEFAULT_TENURE_RELAY_OPTIONS,
  normalizeTenureRelayOptions,
  TENURE_RELAY_DONE_MARKER,
  TENURE_RELAY_MAX_ROUNDS_ENV,
  tenureRelayCodexArgs,
  tenureRelayLaunch,
  tenureRelayWorkerCommand
} from './tenure-relay'

describe('tenure relay (DESIGN.md 36.24, 36.25)', () => {
  it('adds no Codex flags when model and effort are left to the Codex config', () => {
    expect(tenureRelayCodexArgs('', '')).toEqual([])
    expect(tenureRelayCodexArgs('gpt-daybreak-blue-latest', 'ultra')).toEqual([
      '-m',
      'gpt-daybreak-blue-latest',
      '-c',
      'model_reasoning_effort=ultra'
    ])
  })

  it('normalizes input: any listed effort passes, unsafe values drop, no cap by default', () => {
    expect(
      normalizeTenureRelayOptions({
        coordinatorModel: ' gpt-6.1-sol ',
        coordinatorEffort: 'max',
        workerModel: 'gpt; rm -rf /',
        workerEffort: 'ultra -c x=1',
        maxRounds: null
      })
    ).toEqual({
      coordinatorModel: 'gpt-6.1-sol',
      coordinatorEffort: 'max',
      workerModel: '',
      workerEffort: '',
      maxRounds: null
    })
    const rounds = (maxRounds: number | null) =>
      normalizeTenureRelayOptions({ ...DEFAULT_TENURE_RELAY_OPTIONS, maxRounds }).maxRounds
    expect(rounds(0)).toBeNull()
    expect(rounds(Number.NaN)).toBeNull()
    expect(rounds(30)).toBe(30)
    expect(rounds(5000)).toBe(1000)
  })

  it('builds a one-line coordinator prompt with the worker command and done marker', () => {
    const options = { ...DEFAULT_TENURE_RELAY_OPTIONS, workerModel: 'gpt-5.2-codex' }
    const prompt = buildTenureRelayCoordinatorPrompt({
      task: 'say "hi" CLI',
      options,
      cliCommand: 'orca-dev'
    })
    expect(prompt).not.toContain('\n')
    expect(prompt).toContain("과제: say 'hi' CLI")
    expect(prompt).toContain('orca-dev skills get orchestration')
    expect(prompt).toContain(`[${tenureRelayWorkerCommand(options)}]`)
    expect(tenureRelayWorkerCommand(options)).toBe('codex -m gpt-5.2-codex')
    expect(tenureRelayWorkerCommand(options, '--full-auto')).toBe(
      'codex --full-auto -m gpt-5.2-codex'
    )
    expect(tenureRelayWorkerCommand(options, '-c x="y"')).toBe('codex -m gpt-5.2-codex')
    expect(prompt).not.toContain('tenure_relay_round_cap')
    expect(prompt).toContain(`${TENURE_RELAY_DONE_MARKER}:`)
    // Windows PowerShell 5.1 splits a native argument at embedded double quotes.
    expect(prompt).not.toContain('"')
  })

  it('tells the coordinator to wait for the task when none is given', () => {
    const prompt = buildTenureRelayCoordinatorPrompt({
      task: '  ',
      options: DEFAULT_TENURE_RELAY_OPTIONS,
      cliCommand: 'orca'
    })
    expect(prompt).not.toContain('과제:')
    expect(prompt).toContain('기다린다')
    expect(prompt).toContain('링크·첨부 파일')
  })

  it('adds the round cap to prompt and env only when one is set', () => {
    const base = { task: 't', cliCommand: 'orca', baseArgs: '--full-auto', baseEnv: { A: '1' } }
    const free = tenureRelayLaunch({ ...base, options: DEFAULT_TENURE_RELAY_OPTIONS })
    expect(free.agentEnv).toEqual({ A: '1' })
    expect(free.agentArgs).toBe('--full-auto')
    expect(free.prompt).not.toContain('tenure_relay_round_cap')

    const capped = tenureRelayLaunch({
      ...base,
      options: {
        ...DEFAULT_TENURE_RELAY_OPTIONS,
        coordinatorModel: 'gpt-6-astra',
        coordinatorEffort: 'xhigh',
        maxRounds: 12
      }
    })
    expect(capped.agentEnv).toEqual({ A: '1', [TENURE_RELAY_MAX_ROUNDS_ENV]: '12' })
    expect(capped.agentArgs).toBe('--full-auto -m gpt-6-astra -c model_reasoning_effort=xhigh')
    expect(capped.prompt).toContain('최대 12회차')
  })
})
