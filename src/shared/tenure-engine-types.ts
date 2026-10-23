// tenure engine (Python orchestrator) as seen by the desktop shell — DESIGN.md 36.23 M37.

export type TenureEngineStatus = 'starting' | 'ready' | 'failed' | 'stopped'

export type TenureLimitWindow = { usedPercent: number; resetsAt: string | null }

export type TenureEngineLimits = {
  slots: { busy: number; max: number } | null
  claude: { fiveHour: TenureLimitWindow | null; week: TenureLimitWindow | null }
  codex: { fiveHour: TenureLimitWindow | null; week: TenureLimitWindow | null }
}

export type TenureEngineState = {
  status: TenureEngineStatus
  url: string | null
  program: string | null
  detail: string | null
  limits: TenureEngineLimits | null
}

export type TenureEngineMethod = 'GET' | 'POST' | 'DELETE'

export type TenureEngineRequest = {
  method: TenureEngineMethod
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export type TenureEngineResponse = {
  ok: boolean
  status: number
  data: unknown
  error: string | null
}
