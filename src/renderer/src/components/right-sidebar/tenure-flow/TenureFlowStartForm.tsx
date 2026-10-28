import React, { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { tenureCall } from './tenure-flow-api'
import { listWorkflows, type WorkflowListItem } from '../../tenure-workflow/workflow-editor-api'

const WORKFLOWS = ['auto', 'quick', 'race', 'classic'] as const
type FlowWorkflow = (typeof WORKFLOWS)[number]

function workflowLabel(name: FlowWorkflow): string {
  switch (name) {
    case 'auto':
      return translate('tenure.flow.wf.auto', 'Auto')
    case 'quick':
      return translate('tenure.flow.wf.quick', 'Quick (implement + short review)')
    case 'race':
      return translate('tenure.flow.wf.race', 'Race (two drafts, keep the better)')
    case 'classic':
      return translate('tenure.flow.wf.classic', 'Debate (design debate first)')
  }
}

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
  // tenure: workflows saved from the node editor (project or my templates, DESIGN.md 36.29)
  const [saved, setSaved] = useState<WorkflowListItem[]>([])
  useEffect(() => {
    listWorkflows(path)
      .then((items) => setSaved(items.filter((w) => w.source === 'project' || w.source === 'user')))
      .catch(() => setSaved([]))
  }, [path, workflowsVersion])
  const [force, setForce] = useState(false)
  const [mock, setMock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <div className="flex flex-col gap-1">
        {WORKFLOWS.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="radio"
              name="tenure-workflow"
              checked={workflow === name}
              onChange={() => setWorkflow(name)}
            />
            {workflowLabel(name)}
          </label>
        ))}
        {saved.map((w) => (
          <label
            key={w.id}
            className="flex cursor-pointer items-center gap-2 text-xs"
            title={w.summary}
          >
            <input
              type="radio"
              name="tenure-workflow"
              checked={workflow === w.id}
              onChange={() => setWorkflow(w.id)}
            />
            {w.id}
            <span className="text-muted-foreground">{w.source_label}</span>
          </label>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={force} onCheckedChange={(v) => setForce(v === true)} />
        {translate('tenure.flow.force', 'Start even with uncommitted changes')}
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={mock} onCheckedChange={(v) => setMock(v === true)} />
        {translate('tenure.flow.mock', 'Practice run (mock, calls no agent)')}
      </label>
      {error ? <div className="whitespace-pre-wrap text-xs text-destructive">{error}</div> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" size="xs" onClick={onCancel}>
            {translate('tenure.flow.cancel', 'Cancel')}
          </Button>
        ) : null}
        <Button size="xs" disabled={!task.trim() || busy} onClick={() => void submit()}>
          {translate('tenure.flow.start', 'Start')}
        </Button>
      </div>
    </div>
  )
}
