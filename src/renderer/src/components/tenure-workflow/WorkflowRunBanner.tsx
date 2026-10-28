import React from 'react'
import { Pencil } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import type { RunViewDetail } from './use-run-view'
import { statusLabel, type StepStatus } from './run-progress'

const LEGEND: { cls: string; status: StepStatus }[] = [
  { cls: 'ring-2 ring-sky-500', status: 'running' },
  { cls: 'ring-1 ring-emerald-500', status: 'done' },
  { cls: 'ring-2 ring-rose-500', status: 'failed' },
  { cls: 'opacity-45 border', status: 'skipped' }
]

/** tenure: header of the run view (DESIGN.md 36.32): which run, live or not, legend, edit switch. */
export function WorkflowRunBanner({
  detail,
  onEdit
}: {
  detail: RunViewDetail | null
  onEdit: () => void
}): React.JSX.Element {
  const task = detail?.state.task.split('\n')[0] ?? ''
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 pr-12 text-xs">
      <span className="text-sm font-medium">{translate('tenure.progress.title', 'Run view')}</span>
      <span className="min-w-0 max-w-[40%] truncate text-muted-foreground" title={task}>
        {task}
      </span>
      {detail?.live ? (
        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
          <span className="size-1.5 animate-ping rounded-full bg-sky-500" />
          {translate('tenure.progress.live', 'Updating live')}
        </span>
      ) : null}
      <span className="text-muted-foreground">
        {translate('tenure.progress.hint', 'Hover a step to see what happened there.')}
      </span>
      <div className="flex-1" />
      {LEGEND.map((item) => (
        <span key={item.status} className="flex items-center gap-1 text-muted-foreground">
          <span className={`inline-block size-3 rounded bg-card ${item.cls}`} />
          {statusLabel(item.status)}
        </span>
      ))}
      <Button variant="outline" size="xs" onClick={onEdit}>
        <Pencil className="size-3" />
        {translate('tenure.progress.edit', 'Edit this workflow')}
      </Button>
    </div>
  )
}
