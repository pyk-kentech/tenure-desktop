import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { APP_HOME_DIRNAME } from '../../shared/app-home-dirs'
import { IS_TENURE_FORK_BUILD } from '../../shared/tenure-fork-build'
import { writeHooksJson, writeManagedScript } from '../agent-hooks/installer-utils'
import { getClaudeManagedHookPlan } from './claude-managed-hook-events'
import { getManagedScript } from './hook-script'
import {
  applyManagedHooks,
  CLAUDE_HOOK_SETTINGS,
  getManagedEventHook,
  getManagedScriptFileName,
  getManagedScriptPath
} from './hook-settings'
import {
  installWindowsClaudeHookExecutable,
  installWindowsClaudeHookFiles
} from './windows-hook-files'

// tenure: Orca's shell `claude` wrapper passes this file with --settings (DESIGN.md 36.23), restoring
// hook-driven agent status without touching ~/.claude/settings.json.
export const CLAUDE_INLINE_HOOK_SETTINGS_ENV = 'ORCA_CLAUDE_HOOK_SETTINGS'

export function getClaudeInlineHookSettingsPath(): string {
  return join(homedir(), APP_HOME_DIRNAME, 'agent-hooks', 'claude-settings.json')
}

/** Writes the hook scripts and the settings file once per app start; failures leave status title-derived. */
export function prepareClaudeInlineHookSettings(): void {
  if (!IS_TENURE_FORK_BUILD) {
    return
  }
  try {
    // Same scripts and entries ClaudeHookService.install writes, but into an app-owned file.
    const scriptPath = getManagedScriptPath(CLAUDE_HOOK_SETTINGS)
    const windows = process.platform === 'win32'
    const exePath = windows ? installWindowsClaudeHookExecutable(scriptPath) : null
    const config = applyManagedHooks(
      {},
      (eventName) => getManagedEventHook(eventName, scriptPath, CLAUDE_HOOK_SETTINGS, exePath),
      getManagedScriptFileName(CLAUDE_HOOK_SETTINGS),
      getClaudeManagedHookPlan(undefined)
    )
    const payload = getManagedScript('local', {
      skipWhenDevinImportsClaude: true,
      skipWhenGrokImportsClaude: true,
      skipWhenCursorImportsClaude: true
    })
    if (windows) {
      installWindowsClaudeHookFiles(scriptPath, payload)
    } else {
      writeManagedScript(scriptPath, payload)
    }
    writeHooksJson(getClaudeInlineHookSettingsPath(), config)
  } catch (error) {
    console.warn('[tenure] could not prepare Claude inline hook settings', error)
  }
}

/** The pane env entry, only when the file exists so the wrapper never passes a missing path. */
export function claudeInlineHookSettingsEnv(): Record<string, string> {
  const path = getClaudeInlineHookSettingsPath()
  return IS_TENURE_FORK_BUILD && existsSync(path) ? { [CLAUDE_INLINE_HOOK_SETTINGS_ENV]: path } : {}
}
