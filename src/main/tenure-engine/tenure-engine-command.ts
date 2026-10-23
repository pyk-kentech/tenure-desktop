import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export const TENURE_ENGINE_ENV = 'TENURE_ENGINE'

/** Absolute engine executable: env override, then the bundled frozen engine, then the dev checkout's venv. */
export function resolveTenureEngineProgram(): string | null {
  const fromEnv = process.env[TENURE_ENGINE_ENV]?.trim()
  if (fromEnv) {
    return existsSync(fromEnv) ? fromEnv : null
  }
  const win = process.platform === 'win32'
  const candidates = [
    join(process.resourcesPath, 'engine', win ? 'tenure-engine.exe' : 'tenure-engine'),
    // Why: in a dev checkout the fork lives at <tenure repo>/orca and the engine venv beside it.
    join(app.getAppPath(), '..', '.venv', win ? 'Scripts' : 'bin', win ? 'tenure.exe' : 'tenure')
  ]
  return candidates.find((path) => existsSync(path)) ?? null
}

export function tenureEngineArgs(parentPid: number): string[] {
  return ['ui', '--no-browser', '--port', '0', '--ready-line', '--parent-pid', String(parentPid)]
}
