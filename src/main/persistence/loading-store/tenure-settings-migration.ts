import type { GlobalSettings } from '../../../shared/global-settings-types'
import { IS_TENURE_FORK_BUILD } from '../../../shared/tenure-fork-build'

/**
 * tenure, once per profile: earlier fork builds stored agentStatusHooksEnabled=false, which also stopped
 * status ingest. Writes to user-global CLI configs are refused in main now, so turn it back on; a later
 * opt-out by the user sticks because the guard flag stays set.
 */
export function tenureStatusHooksMigration(
  settings: Partial<GlobalSettings> | undefined
): Partial<GlobalSettings> {
  if (!IS_TENURE_FORK_BUILD || settings?.tenureStatusHooksRestored === true) {
    return {}
  }
  return { agentStatusHooksEnabled: true, tenureStatusHooksRestored: true }
}
