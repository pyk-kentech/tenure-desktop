import React, { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { tenureCall } from './tenure-flow-api'
import type { WorkflowListItem } from '../../tenure-workflow/workflow-editor-api'
import { workflowPreview } from '../../tenure-workflow/workflow-titles'

// tenure: under the start form's choices (DESIGN.md 36.37 M52): who does what in the chosen workflow,
// and, for a real run, a warning when an agent it needs is not installed or not logged in.

export function TenureFlowStartPreview({
  item,
  auto
}: {
  item: WorkflowListItem | undefined
  auto: boolean
}): React.JSX.Element | null {
  const lines = item?.steps ? workflowPreview(item.steps, item.roles ?? []) : []
  if (!auto && lines.length === 0) {
    return null
  }
  return (
    <div className="rounded bg-muted/50 px-2 py-1.5 text-2xs leading-relaxed text-muted-foreground">
      {auto
        ? translate(
            'tenure.flow.preview.auto',
            'Reads the task and picks Quick, Race or Design debate. The pick and the reason show in the record.'
          )
        : lines.map((line) => <div key={line}>{line}</div>)}
    </div>
  )
}

/** Login check before a real run; the engine only runs the CLIs' status commands. */
export function useLoginWarnings(project: string, workflow: string, mock: boolean): string[] {
  const [got, setGot] = useState<{ key: string; warnings: string[] } | null>(null)
  const key = `${project}|${workflow}`
  useEffect(() => {
    if (mock) {
      return
    }
    let alive = true
    tenureCall<{ warnings: string[] }>({
      method: 'GET',
      path: '/api/preflight',
      query: { project, workflow }
    })
      .then((res) => {
        if (alive) {
          setGot({ key: `${project}|${workflow}`, warnings: res.warnings })
        }
      })
      .catch(() => {
        // Why: the check only warns; when it cannot run, starting still works as before.
      })
    return () => {
      alive = false
    }
  }, [project, workflow, mock])
  return !mock && got?.key === key ? got.warnings : []
}

export function LoginWarnings({ warnings }: { warnings: string[] }): React.JSX.Element | null {
  if (warnings.length === 0) {
    return null
  }
  return (
    <div className="space-y-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs">
      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-500" />
          <span>{w}</span>
        </div>
      ))}
      <div className="text-muted-foreground">
        {translate(
          'tenure.flow.preflight.how',
          'Log in from a terminal (claude, then /login; or codex login), or select Mock run.'
        )}
      </div>
    </div>
  )
}
