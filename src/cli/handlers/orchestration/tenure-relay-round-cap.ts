import type { RuntimeClient } from '../../runtime-client'
import { getOptionalStringFlag } from '../../flags'
import { RuntimeClientError } from '../../runtime-client'
import { resolveCoordinatorTerminalHandle, runScopedSessionCaller } from './terminal-identity'
import { TENURE_RELAY_MAX_ROUNDS_ENV } from '../../../shared/tenure-relay'

/** tenure: set on the coordinator terminal of a "coordinator + worker" relay (DESIGN.md 36.24). */
export { TENURE_RELAY_MAX_ROUNDS_ENV }

export function readTenureRelayMaxRounds(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env[TENURE_RELAY_MAX_ROUNDS_ENV]?.trim()
  if (!raw || !/^\d+$/.test(raw)) {
    return null
  }
  const value = Number(raw)
  return value > 0 ? value : null
}

/**
 * Refuses a command that would create one more Task once the bound Run already holds the relay's
 * round cap. Each round is one Task, so counting the Run's Tasks counts rounds. Without the env
 * value this is a no-op and upstream behaviour is unchanged.
 */
export async function assertTenureRelayRoundAvailable(
  flags: Map<string, string | boolean>,
  cwd: string,
  client: RuntimeClient
): Promise<void> {
  const cap = readTenureRelayMaxRounds()
  if (cap === null) {
    return
  }
  const run = getOptionalStringFlag(flags, 'run')
  const callerTerminalHandle = run
    ? runScopedSessionCaller(flags)
    : await resolveCoordinatorTerminalHandle(flags, cwd, client)
  let used: number
  try {
    const result = await client.call<{ count: number }>('orchestration.taskList', {
      run,
      callerTerminalHandle
    })
    used = result.result.count
  } catch {
    // Why: no Run is bound yet (the command itself reports that); an absent Run holds no rounds.
    return
  }
  if (used >= cap) {
    throw new RuntimeClientError(
      'tenure_relay_round_cap',
      `tenure 회차 상한(${cap}회)에 닿아 새 작업을 만들지 않습니다. 지금까지의 결과를 사용자에게 보고하고 끝내세요.`,
      { cap, used }
    )
  }
}
