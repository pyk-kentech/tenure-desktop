import type { StepKind } from './workflow-model'
import type { StepProgress } from './run-progress'

// tenure: live per-step detail for the run view (DESIGN.md 36.35). Built from the engine's run
// events (events.jsonl): each agent call's start/end and the console lines, tagged with the
// workflow step they belong to (wf_step). Older runs have no tag; their calls are placed by kind.

export type RunEvent = {
  seq: number
  ts: string
  kind: string
  text?: string
  agent?: string
  role?: string
  step?: string
  round?: number
  attempt?: number
  outcome?: string
  reason?: string
  sec?: number
  wf_step?: string
  visit?: number
  // The call's transcript file in the run folder (step_end only).
  file?: string
}

export type StepCall = {
  agent: string
  role: string
  sub: string
  round: number
  visit: number
  started: string
  sec: number | null
  outcome: string | null
  file: string | null
}
export type StepTimeline = { calls: StepCall[]; logs: { seq: number; ts: string; text: string }[] }

const MAX_LOGS = 300
// Which step kind an untagged call belongs to (runs recorded before wf_step existed).
const SUB_KIND: Record<string, StepKind> = {
  propose: 'debate',
  critique: 'debate',
  synthesize: 'debate',
  implement: 'build',
  design: 'build',
  review: 'build',
  rereview: 'build',
  fix: 'build',
  arbitrate: 'build',
  explore: 'explore',
  audit: 'audit',
  dedup: 'audit'
}

export function stepTimelines(
  events: RunEvent[],
  steps: { id: string; kind: StepKind }[]
): Map<string, StepTimeline> {
  const out = new Map<string, StepTimeline>()
  const ids = new Set(steps.map((s) => s.id))
  const keyOf = (e: RunEvent): string | null => {
    if (e.wf_step) {
      return ids.has(e.wf_step) ? e.wf_step : null
    }
    const kind = e.step ? SUB_KIND[e.step] : undefined
    return kind ? (steps.find((s) => s.kind === kind)?.id ?? null) : null
  }
  const at = (key: string) => {
    let t = out.get(key)
    if (!t) {
      t = { calls: [], logs: [] }
      out.set(key, t)
    }
    return t
  }
  const open = new Map<string, StepCall>()
  const callKey = (e: RunEvent) => `${e.role}|${e.step}|${e.round ?? 0}|${e.attempt ?? 1}`
  for (const e of events) {
    if (e.kind === 'step_start') {
      const key = keyOf(e)
      if (!key) {
        continue
      }
      const call: StepCall = {
        agent: e.agent ?? '',
        role: e.role ?? e.agent ?? '',
        sub: e.step ?? '',
        round: e.round ?? 0,
        visit: e.visit ?? 1,
        started: e.ts,
        sec: null,
        outcome: null,
        file: null
      }
      at(key).calls.push(call)
      open.set(callKey(e), call)
    } else if (e.kind === 'step_end') {
      const call = open.get(callKey(e))
      if (call) {
        call.sec = e.sec ?? 0
        call.outcome = e.outcome ?? null
        call.file = e.file ?? null
        open.delete(callKey(e))
      }
    } else if (e.kind === 'log' && e.wf_step && ids.has(e.wf_step) && e.text) {
      const logs = at(e.wf_step).logs
      logs.push({ seq: e.seq, ts: e.ts, text: e.text })
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS)
      }
    }
  }
  return out
}

/** Step progress with each step's live detail attached. */
export function withTimelines(
  progress: Map<string, StepProgress> | null,
  timelines: Map<string, StepTimeline>
): Map<string, StepProgress> | null {
  if (!progress) {
    return null
  }
  const out = new Map<string, StepProgress>()
  for (const [key, p] of progress) {
    const timeline = timelines.get(key)
    out.set(key, timeline ? { ...p, timeline } : p)
  }
  return out
}

/** Seconds from an engine timestamp (local time, no zone) to `now`. */
export function secondsSince(ts: string, now: number): number {
  const t = Date.parse(ts)
  return Number.isNaN(t) ? 0 : Math.max(0, (now - t) / 1000)
}

export function clock(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

/** Time spent in a step: finished calls plus the running ones so far. */
export function stepSeconds(t: StepTimeline, now: number): number {
  return t.calls.reduce((sum, c) => sum + (c.sec ?? secondsSince(c.started, now)), 0)
}
