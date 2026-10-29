import React, { useEffect, useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { tenureCall } from '../right-sidebar/tenure-flow/tenure-flow-api'
import { kindLabel } from './workflow-labels'
import { statusLabel } from './run-progress'
import { RunCallList, RunLogLines } from './WorkflowRunDetails'
import type { StepNode } from './workflow-model'

// tenure: the run log panel (DESIGN.md 36.35). Clicking a step in the run view shows all of its
// calls and log lines as they arrive, and what the agent is doing right now while it runs.

type Activity = {
  live: boolean
  call: { agent: string; step: string } | null
  events: { ts: string | null; kind: string; text: string; detail: string }[]
}

const ACTIVITY_MS = 2000

function activityKind(kind: string): string {
  switch (kind) {
    case 'read':
      return translate('tenure.progress.act.read', 'Read')
    case 'edit':
      return translate('tenure.progress.act.edit', 'Edit')
    case 'command':
      return translate('tenure.progress.act.command', 'Run')
    case 'search':
      return translate('tenure.progress.act.search', 'Search')
    case 'message':
      return translate('tenure.progress.act.message', 'Says')
    default:
      return translate('tenure.progress.act.tool', 'Tool')
  }
}

function useActivity(project: string, runId: string, enabled: boolean): Activity | null {
  const [got, setGot] = useState<{ key: string; activity: Activity } | null>(null)
  const key = `${runId}:${enabled}`
  useEffect(() => {
    if (!enabled) {
      return
    }
    let alive = true
    let timer: number | undefined
    const read = async () => {
      try {
        const a = await tenureCall<Activity>({
          method: 'GET',
          path: '/api/activity',
          query: { project, run: runId }
        })
        if (alive) {
          setGot({ key: `${runId}:true`, activity: a })
        }
      } catch {
        // Why: activity is a nice-to-have; keep the last picture and try again.
      }
      if (alive) {
        timer = window.setTimeout(() => void read(), ACTIVITY_MS)
      }
    }
    void read()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [project, runId, enabled])
  return got && got.key === key ? got.activity : null
}

export function WorkflowRunPanel({
  project,
  runId,
  step
}: {
  project: string
  runId: string
  step: StepNode
}): React.JSX.Element {
  const progress = step.data.progress
  const timeline = progress?.timeline
  const runningCall = timeline?.calls.findLast((c) => c.sec === null)
  const activity = useActivity(project, runId, !!runningCall)
  const mine = activity?.call && runningCall && activity.call.agent === runningCall.role
  const bottom = useRef<HTMLDivElement>(null)
  const count = (timeline?.logs.length ?? 0) + (mine ? activity.events.length : 0)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [count])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-xs scrollbar-sleek">
      <div>
        <div className="text-sm font-medium">{kindLabel(step.data.kind)}</div>
        <div className="text-muted-foreground">
          {progress ? statusLabel(progress.status) : ''}
          {progress?.lines.length ? ` · ${progress.lines.join(' · ')}` : ''}
        </div>
      </div>
      <section>
        <div className="mb-1 font-medium">{translate('tenure.progress.calls', 'Agent calls')}</div>
        {timeline?.calls.length ? (
          <RunCallList timeline={timeline} />
        ) : (
          <div className="text-muted-foreground">
            {translate('tenure.progress.noRecord', 'No record yet.')}
          </div>
        )}
      </section>
      {mine && activity.events.length ? (
        <section>
          <div className="mb-1 font-medium">
            {translate('tenure.progress.doing', 'What {{value0}} is doing now', {
              value0: runningCall.role
            })}
          </div>
          <div className="space-y-1">
            {activity.events.slice(-30).map((ev) => (
              <div key={`${ev.ts}-${ev.kind}-${ev.text}`} className="break-words">
                <span className="mr-1 rounded bg-muted px-1 text-[10px]">
                  {activityKind(ev.kind)}
                </span>
                {ev.text}
                {ev.detail ? <span className="text-muted-foreground"> {ev.detail}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {timeline?.logs.length ? (
        <section>
          <div className="mb-1 font-medium">{translate('tenure.progress.log', 'Log')}</div>
          <RunLogLines logs={timeline.logs} />
        </section>
      ) : null}
      <div ref={bottom} />
    </div>
  )
}
