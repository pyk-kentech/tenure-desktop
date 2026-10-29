import React, { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { tenureCall } from './tenure-flow-api'
import { listWorkflows, type WorkflowListItem } from '../../tenure-workflow/workflow-editor-api'
import { workflowHint, workflowTitle } from '../../tenure-workflow/workflow-titles'
import { LoginWarnings, TenureFlowStartPreview, useLoginWarnings } from './TenureFlowStartPreview'

const WORKFLOWS = ['auto', 'quick', 'race', 'classic'] as const

/** Starts a tenure flow in this workspace folder itself: the workspace is already an isolated worktree. */
export function TenureFlowStartForm({
  path,
  workflowsVersion,
  onStarted,
  onCancel
}: {
  path: string
  workflowsVersion: number
  onStarted: (runId: string) => void
  onCancel?: () => void
}): React.JSX.Element {
  const [task, setTask] = useState('')
  const [workflow, setWorkflow] = useState<string>('auto')
  // tenure: every workflow, for the preview; saved ones (project or my templates, DESIGN.md 36.29)
  // also get their own choice.
  const [all, setAll] = useState<WorkflowListItem[]>([])
  useEffect(() => {
    listWorkflows(path)
      .then(setAll)
      .catch(() => setAll([]))
  }, [path, workflowsVersion])
  const saved = all.filter((w) => w.source === 'project' || w.source === 'user')
  const [force, setForce] = useState(false)
  const [mock, setMock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const warnings = useLoginWarnings(path, workflow, mock)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await tenureCall<{ run_id: string }>({
        method: 'POST',
        path: '/api/actions/run',
        body: {
          project: path,
          task,
          workflow: workflow === 'auto' ? undefined : workflow,
          force,
          mock,
          options: { worktree: 'off' }
        }
      })
      setTask('')
      onStarted(res.run_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-3">
      <div className="text-xs font-medium">
        {translate('tenure.flow.startTitle', 'Start a flow here')}
      </div>
      <Textarea
        data-tenure-tour="task"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        rows={4}
        placeholder={translate(
          'tenure.flow.taskPlaceholder',
          'What should be built or fixed? The agents implement, review and fix in rounds.'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && task.trim() && !busy) {
            e.preventDefault()
            void submit()
          }
        }}
      />
      <div className="flex flex-col gap-1" data-tenure-tour="workflow-choice">
        {WORKFLOWS.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="radio"
              name="tenure-workflow"
              checked={workflow === name}
              onChange={() => setWorkflow(name)}
            />
            {workflowTitle(name)}
            <span className="text-muted-foreground">{workflowHint(name)}</span>
          </label>
        ))}
        {saved.map((w) => (
          <label key={w.id} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="radio"
              name="tenure-workflow"
              checked={workflow === w.id}
              onChange={() => setWorkflow(w.id)}
            />
            {workflowTitle(w.id, w.name)}
            <span className="text-muted-foreground">{w.source_label}</span>
          </label>
        ))}
      </div>
      <TenureFlowStartPreview
        item={all.find((w) => w.id === workflow)}
        auto={workflow === 'auto'}
      />
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} />
        {translate('tenure.flow.force', 'Start even with uncommitted changes')}
      </label>
      <label
        className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
        data-tenure-tour="mock"
      >
        <Checkbox checked={mock} onCheckedChange={(v) => setMock(v === true)} />
        {translate('tenure.flow.mock', 'Mock run (no agent calls)')}
      </label>
      <LoginWarnings warnings={warnings} />
      {error ? <div className="whitespace-pre-wrap text-xs text-destructive">{error}</div> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" size="xs" onClick={onCancel}>
            {translate('tenure.flow.cancel', 'Cancel')}
          </Button>
        ) : null}
        <Button
          size="xs"
          data-tenure-tour="start"
          disabled={!task.trim() || busy}
          onClick={() => void submit()}
        >
          {translate('tenure.flow.start', 'Start')}
        </Button>
      </div>
    </div>
  )
}
