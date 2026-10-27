import type { TenureEngineRequest } from '../../../../../shared/tenure-engine-types'

// Engine payload slices this panel reads (tenure src/tenure/ui/dashboard.py `runs` / `run`).
export type TenureRunSummary = {
  run_id: string
  status: string
  phase: string
  step: string
  round: number
  task: string
  updated_at?: string
  live?: boolean
  activity?: { state: string; reason: string }
  config?: { workflow?: string }
}

export type TenureRunEntry = {
  name: string
  seq: number
  label: string
  meta: Record<string, string>
  verdict?: { status: string; must_fix?: number } | null
}

export type TenureDraft = {
  branch: string
  approved: boolean
  blocking: number | null
  tests: string | null
  lines: number
  files: number
  reviewer: string
}

export type TenureRace = {
  drafters: string[]
  drafts: Record<string, TenureDraft>
  winner?: string
  picked?: string
  reason?: string
}

export type TenureRunDetail = {
  project: string
  run_dir: string
  live: boolean
  state: {
    run_id: string
    task: string
    status: string
    phase: string
    step: string
    round: number
    error?: string | null
    report?: string | null
    workflow?: { name?: string } | null
    race?: TenureRace | null
  }
  entries: TenureRunEntry[]
  current_call: { agent: string; step: string; elapsed_sec: number } | null
  resume: { possible: boolean; reason: string }
  activity: { state: string; reason: string }
}

export class TenureFlowError extends Error {}

export async function tenureCall<T>(req: TenureEngineRequest): Promise<T> {
  const api = window.api.tenureEngine
  if (!api) {
    throw new TenureFlowError('tenure engine is not available in this window.')
  }
  const res = await api.request(req)
  if (!res.ok) {
    throw new TenureFlowError(res.error ?? `HTTP ${res.status}`)
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the engine owns these JSON shapes; the panel reads optional fields defensively.
  return res.data as T
}
