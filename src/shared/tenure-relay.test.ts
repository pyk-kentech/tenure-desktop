import { describe, expect, it } from 'vitest'
import {
  buildTenureRelayCoordinatorPrompt,
  DEFAULT_TENURE_RELAY_OPTIONS,
  normalizeTenureRelayOptions,
  TENURE_RELAY_DONE_MARKER,
  tenureRelayCodexArgs,
  tenureRelayWorkerCommand
} from './tenure-relay'

describe('tenure relay (DESIGN.md 36.24)', () => {
  it('adds no Codex flags when model and effort are left to the Codex config', () => {
    expect(tenureRelayCodexArgs('', '')).toEqual([])
    expect(tenureRelayCodexArgs('gpt-5.5', 'high')).toEqual([
      '-m',
      'gpt-5.5',
      '-c',
      'model_reasoning_effort=high'
    ])
  })

  it('normalizes input: drops unsafe model ids, clamps rounds', () => {
    const normalized = normalizeTenureRelayOptions({
      coordinatorModel: ' gpt-5.5 ',
      coordinatorEffort: 'bogus' as never,
      workerModel: 'gpt; rm -rf /',
      workerEffort: 'low',
      maxRounds: 99
    })
    expect(normalized).toEqual({
      coordinatorModel: 'gpt-5.5',
      coordinatorEffort: '',
      workerModel: '',
      workerEffort: 'low',
      maxRounds: 20
    })
    expect(
      normalizeTenureRelayOptions({
        ...DEFAULT_TENURE_RELAY_OPTIONS,
        maxRounds: 0
      }).maxRounds
    ).toBe(5)
    expect(
      normalizeTenureRelayOptions({
        ...DEFAULT_TENURE_RELAY_OPTIONS,
        maxRounds: Number.NaN
      }).maxRounds
    ).toBe(5)
  })

  it('builds a one-line coordinator prompt with the worker command, cap and done marker', () => {
    const options = {
      ...DEFAULT_TENURE_RELAY_OPTIONS,
      workerModel: 'gpt-5.2-codex',
      maxRounds: 3
    }
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
    expect(prompt).toContain('최대 3회차')
    expect(prompt).toContain(`${TENURE_RELAY_DONE_MARKER}:`)
    // Windows PowerShell 5.1 splits a native argument at embedded double quotes.
    expect(prompt).not.toContain('"')
  })
})
