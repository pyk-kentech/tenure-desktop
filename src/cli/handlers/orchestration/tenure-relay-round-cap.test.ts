import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ORCHESTRATION_HANDLERS } from '../orchestration'
import { readTenureRelayMaxRounds, TENURE_RELAY_MAX_ROUNDS_ENV } from './tenure-relay-round-cap'

type Call = { name: string; params: Record<string, unknown> }

describe('tenure relay round cap (DESIGN.md 36.24)', () => {
  const originalCap = process.env[TENURE_RELAY_MAX_ROUNDS_ENV]
  const originalTerminalHandle = process.env.ORCA_TERMINAL_HANDLE
  let calls: Call[]
  let taskCount: number
  let taskListFails: boolean

  const client = {
    call: async (name: string, params: Record<string, unknown>) => {
      if (name === 'terminal.resolveIdentity') {
        return { result: { identity: { live: true } } }
      }
      calls.push({ name, params })
      if (name === 'orchestration.taskList') {
        if (taskListFails) {
          throw new Error('no run bound')
        }
        return { result: { tasks: [], count: taskCount } }
      }
      if (name === 'orchestration.taskCreate') {
        return { result: { task: { id: 'task_new', status: 'ready' } } }
      }
      if (name === 'orchestration.workerStart') {
        return {
          result: {
            runId: 'run_1',
            taskId: 'task_new',
            dispatchId: 'dispatch_1',
            state: 'ready',
            effects: [],
            residualResources: []
          }
        }
      }
      throw new Error(`unexpected call ${name}`)
    }
  }

  beforeEach(() => {
    calls = []
    taskCount = 0
    taskListFails = false
    process.env.ORCA_TERMINAL_HANDLE = 'term_coord'
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const [key, value] of [
      [TENURE_RELAY_MAX_ROUNDS_ENV, originalCap],
      ['ORCA_TERMINAL_HANDLE', originalTerminalHandle]
    ] as const) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  async function run(command: string, flags: Map<string, string | boolean>) {
    await ORCHESTRATION_HANDLERS[command]({
      flags,
      client,
      cwd: '/tmp/repo',
      json: true
    } as never)
  }

  it('reads only a positive integer cap', () => {
    expect(readTenureRelayMaxRounds({})).toBeNull()
    expect(readTenureRelayMaxRounds({ [TENURE_RELAY_MAX_ROUNDS_ENV]: '0' })).toBeNull()
    expect(readTenureRelayMaxRounds({ [TENURE_RELAY_MAX_ROUNDS_ENV]: 'abc' })).toBeNull()
    expect(readTenureRelayMaxRounds({ [TENURE_RELAY_MAX_ROUNDS_ENV]: ' 5 ' })).toBe(5)
  })

  it('leaves task-create untouched without the env value', async () => {
    delete process.env[TENURE_RELAY_MAX_ROUNDS_ENV]
    await run('orchestration task-create', new Map([['spec', 'do it']]))
    expect(calls.map((call) => call.name)).toEqual(['orchestration.taskCreate'])
  })

  it('allows task-create below the cap', async () => {
    process.env[TENURE_RELAY_MAX_ROUNDS_ENV] = '3'
    taskCount = 2
    await run('orchestration task-create', new Map([['spec', 'do it']]))
    expect(calls.map((call) => call.name)).toEqual([
      'orchestration.taskList',
      'orchestration.taskCreate'
    ])
  })

  it('refuses task-create at the cap', async () => {
    process.env[TENURE_RELAY_MAX_ROUNDS_ENV] = '3'
    taskCount = 3
    await expect(
      run('orchestration task-create', new Map([['spec', 'do it']]))
    ).rejects.toMatchObject({ code: 'tenure_relay_round_cap' })
    expect(calls.map((call) => call.name)).not.toContain('orchestration.taskCreate')
  })

  it('refuses worker-start --spec at the cap but lets --task start a counted Task', async () => {
    process.env[TENURE_RELAY_MAX_ROUNDS_ENV] = '2'
    taskCount = 2
    await expect(
      run(
        'orchestration worker-start',
        new Map([
          ['spec', 'do it'],
          ['agent', 'codex']
        ])
      )
    ).rejects.toMatchObject({ code: 'tenure_relay_round_cap' })
    expect(calls.map((call) => call.name)).not.toContain('orchestration.workerStart')

    calls = []
    await run(
      'orchestration worker-start',
      new Map([
        ['task', 'task_2'],
        ['terminal', 'term_worker']
      ])
    )
    expect(calls.map((call) => call.name)).not.toContain('orchestration.taskList')
    expect(calls.map((call) => call.name)).toContain('orchestration.workerStart')
  })

  it('does not block when no Run is bound yet', async () => {
    process.env[TENURE_RELAY_MAX_ROUNDS_ENV] = '1'
    taskListFails = true
    await run('orchestration task-create', new Map([['spec', 'do it']]))
    expect(calls.map((call) => call.name)).toContain('orchestration.taskCreate')
  })
})
