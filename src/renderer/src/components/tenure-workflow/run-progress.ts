import { translate } from '@/i18n/i18n'
import type { StepKind } from './workflow-model'

// tenure: per-step progress of a flow run for the graph view (DESIGN.md 36.32). Reads the engine's
// saved run state (run.json via /api/run); never guesses beyond what the state records.

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'
export type StepProgress = { status: StepStatus; lines: string[] }

export type RunStateLike = {
  status: string
  phase?: string
  step?: string
  done?: string[]
  review_history?: { round?: number; approved?: boolean; blocking?: number | null }[]
  tests?: Record<string, { status?: string }>
  audits?: Record<string, { role: string; approved?: boolean }[]>
  graph?: { decisions?: Record<string, string>; continue?: Record<string, number> }
}
export type CurrentCall = { agent: string; step: string; elapsed_sec: number } | null

type StepRef = { id: string; kind: StepKind; branches?: string[] }

const FINISHED = new Set([
  'done_approved',
  'done_unapproved',
  'done_design',
  'failed',
  'stopped_user',
  'stopped_rate_limit'
])

function reviewRound(key: string): number | null {
  const m = /^review:(\d+)$/.exec(key)
  return m ? Number(m[1]) : null
}

/** Review rounds that happened before `marker` was recorded, after `from` (indexes into state.done). */
function roundsBetween(done: string[], from: number, marker: string): number[] {
  const end = done.indexOf(marker)
  const slice = done.slice(from, end === -1 ? undefined : end + 1)
  return slice.map(reviewRound).filter((n): n is number => n !== null)
}

function testLabel(status: string): string {
  switch (status) {
    case 'passed':
      return translate('tenure.progress.testStatus.passed', 'passed')
    case 'failed':
      return translate('tenure.progress.testStatus.failed', 'failed')
    case 'timeout':
      return translate('tenure.progress.testStatus.timeout', 'timed out')
    default:
      return translate('tenure.progress.testStatus.error', 'could not run')
  }
}

function verdictLine(st: RunStateLike, round: number): string {
  const h = st.review_history?.find((r) => r.round === round)
  const test = st.tests?.[String(round)]?.status
  const parts = [
    translate('tenure.progress.round', 'Round {{value0}}', { value0: String(round) }),
    h?.approved
      ? translate('tenure.flow.verdict.approved', 'Approved')
      : translate('tenure.flow.verdict.changes', 'Changes requested')
  ]
  if (!h?.approved && typeof h?.blocking === 'number') {
    parts.push(
      translate('tenure.progress.blocking', '{{value0}} blocking', { value0: String(h.blocking) })
    )
  }
  if (test) {
    parts.push(translate('tenure.progress.test', 'tests {{value0}}', { value0: testLabel(test) }))
  }
  return parts.join(' · ')
}

export function runProgress(
  steps: StepRef[],
  st: RunStateLike,
  live: boolean,
  call: CurrentCall
): Map<string, StepProgress> {
  const done = st.done ?? []
  const has = (k: string) => done.includes(k)
  const finished = FINISHED.has(st.status) && !live
  // Why: a failed run is no longer live, but its position still marks where it stopped.
  const active = live || st.status === 'failed'
  const out = new Map<string, StepProgress>()
  const buildEnd = done.indexOf('build')
  for (const step of steps) {
    const lines: string[] = []
    let status: StepStatus = 'pending'
    if (step.kind === 'explore') {
      status = has(`explore:${step.id}`)
        ? 'done'
        : active && st.phase === 'explore'
          ? 'running'
          : 'pending'
    } else if (step.kind === 'debate') {
      status = has('debate') ? 'done' : active && st.phase === 'debate' ? 'running' : 'pending'
    } else if (step.kind === 'build') {
      const rounds = roundsBetween(done, 0, 'build')
      rounds.forEach((r) => lines.push(verdictLine(st, r)))
      status = has('build')
        ? 'done'
        : active && st.phase === 'build' && buildEnd === -1
          ? 'running'
          : 'pending'
    } else if (step.kind === 'continue') {
      const target = st.graph?.continue?.[step.id]
      if (target !== undefined) {
        const rounds = roundsBetween(done, Math.max(buildEnd, 0), `continue:${step.id}`)
        lines.push(
          translate('tenure.progress.until', 'Runs up to round {{value0}}', {
            value0: String(target)
          })
        )
        rounds.forEach((r) => lines.push(verdictLine(st, r)))
        status = has(`continue:${step.id}`) ? 'done' : active ? 'running' : 'pending'
      }
    } else if (step.kind === 'audit') {
      const results = Object.entries(st.audits ?? {})
        .filter(([id]) => id === step.id || id.startsWith(`${step.id}_`))
        .flatMap(([, rs]) => rs)
      results.forEach((r) =>
        lines.push(
          `${r.role}: ${r.approved ? translate('tenure.progress.clean', 'no issues') : translate('tenure.progress.check', 'needs a look')}`
        )
      )
      status = has(`audit:${step.id}`)
        ? 'done'
        : active && st.phase === 'audit'
          ? 'running'
          : 'pending'
    } else if (step.kind === 'branch') {
      const decisions = Object.entries(st.graph?.decisions ?? {})
        .filter(([k]) => k.startsWith(`${step.id}#`))
        .sort(([a], [b]) => a.localeCompare(b))
      decisions.forEach(([k, v]) =>
        lines.push(
          translate('tenure.progress.decision', 'Pass {{value0}}: {{value1}}', {
            value0: k.split('#')[1],
            value1:
              v === 'yes'
                ? translate('tenure.workflow.out.yes', 'Yes')
                : translate('tenure.workflow.out.no', 'No')
          })
        )
      )
      status = decisions.length ? 'done' : 'pending'
    } else if (step.kind === 'parallel') {
      const all = (step.branches ?? []).map(
        (b) => out.get(b)?.status ?? (has(`audit:${b}`) || has(`explore:${b}`) ? 'done' : 'pending')
      )
      status =
        all.length && all.every((s) => s === 'done')
          ? 'done'
          : all.some((s) => s !== 'pending')
            ? 'running'
            : 'pending'
    }
    if (status === 'running' && call) {
      lines.push(
        translate('tenure.progress.now', 'Now: {{value0}} · {{value1}} ({{value2}}s)', {
          value0: call.agent,
          value1: call.step,
          value2: String(Math.round(call.elapsed_sec))
        })
      )
    }
    if (status === 'running' && st.status === 'failed') {
      status = 'failed'
    }
    if (status === 'pending' && finished) {
      status = 'skipped'
    }
    out.set(step.id, { status, lines })
  }
  return out
}

export function statusLabel(status: StepStatus): string {
  switch (status) {
    case 'running':
      return translate('tenure.progress.status.running', 'In progress')
    case 'done':
      return translate('tenure.progress.status.done', 'Done')
    case 'failed':
      return translate('tenure.progress.status.failed', 'Failed')
    case 'skipped':
      return translate('tenure.progress.status.skipped', 'Not reached')
    default:
      return translate('tenure.progress.status.pending', 'Waiting')
  }
}
