import React, { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { stepLabel } from '../right-sidebar/tenure-flow/tenure-flow-labels'
import { clock, secondsSince, stepSeconds, type StepCall, type StepTimeline } from './step-timeline'
import { ROW_H } from './workflow-node-rows'

// tenure: live detail of a step in the run view (DESIGN.md 36.35): the node's bottom line, the call
// list on its hover card and in the run log panel.

/** The current time, ticking every second while `active`. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) {
      return
    }
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

function running(t: StepTimeline): StepCall | undefined {
  return t.calls.findLast((c) => c.sec === null)
}

function callWhat(c: StepCall): string {
  const what = stepLabel(c.sub)
  return c.round > 0
    ? `${what} ${translate('tenure.progress.roundShort', '(round {{value0}})', { value0: String(c.round) })}`
    : what
}

function outcomeLabel(outcome: string | null): string {
  switch (outcome) {
    case 'done':
      return translate('tenure.progress.outcome.done', 'done')
    case 'blocked':
      return translate('tenure.progress.outcome.blocked', 'blocked')
    case 'failed':
      return translate('tenure.progress.outcome.failed', 'failed')
    case 'unconfirmed':
      return translate('tenure.progress.outcome.unconfirmed', 'unconfirmed')
    default:
      return ''
  }
}

const OUTCOME_DOT: Record<string, string> = {
  done: 'bg-emerald-500',
  blocked: 'bg-amber-500',
  failed: 'bg-rose-500',
  unconfirmed: 'bg-zinc-400'
}

/** The node's bottom line: the running call and its time, or how many calls took how long. */
export function RunFooter({ timeline }: { timeline: StepTimeline }): React.JSX.Element | null {
  const now_ = running(timeline)
  const now = useNow(!!now_)
  if (timeline.calls.length === 0) {
    return null
  }
  const text = now_
    ? `${now_.role} · ${callWhat(now_)} · ${clock(secondsSince(now_.started, now))}`
    : translate('tenure.progress.summary', '{{value0}} calls · {{value1}}', {
        value0: String(timeline.calls.length),
        value1: clock(stepSeconds(timeline, now))
      })
  return (
    <div
      className={`flex items-center gap-1.5 truncate border-t border-border/60 px-2.5 text-[11px] ${now_ ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'}`}
      style={{ height: ROW_H }}
    >
      {now_ ? <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-sky-500" /> : null}
      <span className="truncate">{text}</span>
    </div>
  )
}

/** Calls of a step, newest last; the running one counts up. With `renderBody`, clicking a finished
 * call opens its reply under it (DESIGN.md 36.37 M52). */
export function RunCallList({
  timeline,
  limit,
  renderBody
}: {
  timeline: StepTimeline
  limit?: number
  renderBody?: (file: string) => React.ReactNode
}): React.JSX.Element {
  const live = !!running(timeline)
  const now = useNow(live)
  const [open, setOpen] = useState<string | null>(null)
  const calls = limit ? timeline.calls.slice(-limit) : timeline.calls
  return (
    <div className="space-y-0.5">
      {limit && timeline.calls.length > limit ? (
        <div className="text-muted-foreground">
          {translate('tenure.progress.earlier', '… {{value0}} earlier', {
            value0: String(timeline.calls.length - limit)
          })}
        </div>
      ) : null}
      {calls.map((c) => {
        const file = renderBody ? c.file : null
        const row = (
          <div className="flex items-center gap-1.5">
            <span
              className={`size-1.5 shrink-0 rounded-full ${c.sec === null ? 'animate-pulse bg-sky-500' : (OUTCOME_DOT[c.outcome ?? ''] ?? 'bg-zinc-400')}`}
            />
            <span className="min-w-0 flex-1 truncate">
              {c.role} · {callWhat(c)}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {c.sec === null
                ? clock(secondsSince(c.started, now))
                : `${clock(c.sec)} ${outcomeLabel(c.outcome)}`}
            </span>
          </div>
        )
        return (
          <div key={`${c.started}-${c.role}-${c.sub}-${c.round}`}>
            {file ? (
              <button
                type="button"
                className="w-full rounded text-left hover:bg-accent/60"
                title={translate('tenure.progress.openReply', 'Show the reply')}
                onClick={() => setOpen(open === file ? null : file)}
              >
                {row}
              </button>
            ) : (
              row
            )}
            {file && open === file ? <div className="mt-1">{renderBody?.(file)}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

export function RunLogLines({
  logs,
  limit
}: {
  logs: StepTimeline['logs']
  limit?: number
}): React.JSX.Element {
  const shown = limit ? logs.slice(-limit) : logs
  return (
    <div className="space-y-0.5 font-mono text-[11px] leading-snug text-muted-foreground">
      {shown.map((l) => (
        <div key={l.seq} className="break-words">
          <span className="mr-1 opacity-60">{l.ts.slice(11, 19)}</span>
          {l.text}
        </div>
      ))}
    </div>
  )
}
