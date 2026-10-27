import { homedir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { APP_HOME_DIRNAME } from '../../shared/app-home-dirs'
import { IS_TENURE_FORK_BUILD } from '../../shared/tenure-fork-build'

/**
 * tenure: a write that would land in an agent CLI's own config under the user's home
 * (~/.claude, ~/.codex, ~/.gemini, ~/.config/...). The fork never edits those; hooks are attached
 * per launch instead (DESIGN.md 36.23). Orca-owned homes live under userData and stay writable.
 */
export function isUserGlobalAgentConfigPath(path: string): boolean {
  if (!IS_TENURE_FORK_BUILD) {
    return false
  }
  const rel = relative(resolve(homedir()), resolve(path))
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    return false
  }
  const first = rel.split(/[\\/]/)[0] ?? ''
  return first.startsWith('.') && first !== APP_HOME_DIRNAME
}

/** True (and logs once per path) when the caller must skip writing `path`. */
export function refuseUserGlobalAgentConfigWrite(path: string): boolean {
  if (!isUserGlobalAgentConfigPath(path)) {
    return false
  }
  if (!refused.has(path)) {
    refused.add(path)
    console.warn(`[tenure] not writing user-global agent config: ${path}`)
  }
  return true
}

const refused = new Set<string>()
