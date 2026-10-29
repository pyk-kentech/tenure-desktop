import React, { useState } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { tenureCall, type TenureRunSummary } from './tenure-flow-api'
import { TenureFlowStateDot } from './tenure-flow-labels'
import { clock, secondsSince } from '../../tenure-workflow/step-timeline'
import { workflowTitle } from '../../tenure-workflow/workflow-titles'
import { useNow } from '../../tenure-workflow/WorkflowRunDetails'

// tenure: the flow list (DESIGN.md 36.37 M52): when each flow started and how long it took, and
// archive (hide, keep the record) or delete (remove the record) for finished ones.

const SHOWN = 8

function when(run: TenureRunSummary, now: number): string {
  const start = run.created_at ?? ''
  const day = start.slice(5, 10).replace('-', '/')
  const time = start.slice(11, 16)
  const end = run.live ? now : Date.parse(run.updated_at ?? '')
  const took = start && !Number.isNaN(end) ? clock(secondsSince(start, end)) : ''
  return [day && `${day} ${time}`, took].filter(Boolean).join(' · ')
}

export function TenureFlowRunList({
  runs,
  project,
  selected,
  onSelect,
  onChanged
}: {
  runs: TenureRunSummary[]
  project: string
  selected: string | null
  onSelect: (runId: string) => void
  onChanged: (removed?: string) => void
}): React.JSX.Element | null {
  const [showArchived, setShowArchived] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const archived = runs.filter((r) => r.archived_at)
  // Why: taking the last flow out of the archive goes back to the normal list.
  const inArchive = showArchived && archived.length > 0
  const list = runs.filter((r) => !!r.archived_at === inArchive)
  const shown = showAll ? list : list.slice(0, SHOWN)
  const now = useNow(runs.some((r) => r.live))
  if (runs.length < 2 && archived.length === 0) {
    return null
  }

  const call = async (path: string, body: Record<string, unknown>, removed?: string) => {
    setError(null)
    try {
      await tenureCall({ method: 'POST', path, body: { project, ...body } })
      onChanged(removed)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div className="flex flex-col border-b border-border py-1">
      {shown.map((run) => (
        <div key={run.run_id}>
          <div
            className={`group flex items-center gap-2 px-3 py-1 text-xs hover:bg-accent/60 ${
              run.run_id === selected ? 'bg-accent' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(run.run_id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <TenureFlowStateDot state={run.live ? 'working' : (run.activity?.state ?? 'idle')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{run.task.split('\n')[0]}</span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {[workflowTitle(run.config?.workflow ?? ''), when(run, now)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
            {run.live ? null : (
              <span className="hidden shrink-0 gap-0.5 group-hover:flex">
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={
                    run.archived_at
                      ? translate('tenure.flow.list.unarchive', 'Take out of the archive')
                      : translate('tenure.flow.list.archive', 'Archive (hide from the list)')
                  }
                  onClick={() =>
                    void call('/api/runs/archive', { run: run.run_id, archived: !run.archived_at })
                  }
                >
                  {run.archived_at ? (
                    <ArchiveRestore className="size-3" />
                  ) : (
                    <Archive className="size-3" />
                  )}
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  title={translate('tenure.flow.list.delete', 'Delete the record')}
                  onClick={() => setConfirm(run.run_id)}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            )}
          </div>
          {confirm === run.run_id ? (
            <div className="flex flex-wrap items-center gap-2 px-3 py-1 text-xs">
              <span className="text-muted-foreground">
                {translate(
                  'tenure.flow.list.confirmDelete',
                  'Delete this flow’s record? Code changes stay as they are.'
                )}
              </span>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => void call('/api/runs/delete', { run: run.run_id }, run.run_id)}
              >
                {translate('tenure.flow.list.deleteNow', 'Delete')}
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirm(null)}>
                {translate('tenure.flow.cancel', 'Cancel')}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {error ? <div className="px-3 py-1 text-xs text-destructive">{error}</div> : null}
      <div className="flex gap-3 px-3 pt-1 text-2xs text-muted-foreground">
        {list.length > SHOWN ? (
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? translate('tenure.flow.list.fewer', 'Show fewer')
              : translate('tenure.flow.list.all', 'Show all {{value0}}', {
                  value0: String(list.length)
                })}
          </button>
        ) : null}
        {archived.length ? (
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => setShowArchived(!inArchive)}
          >
            {inArchive
              ? translate('tenure.flow.list.back', 'Back to flows')
              : translate('tenure.flow.list.archived', 'Archived ({{value0}})', {
                  value0: String(archived.length)
                })}
          </button>
        ) : null}
      </div>
    </div>
  )
}
