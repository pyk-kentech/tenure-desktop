import React, { useCallback, useEffect, useState } from 'react'
import { GraduationCap, Network, Play, Square, RotateCw, Workflow } from 'lucide-react'
import { useActiveWorktree } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { tenureCall, type TenureRunDetail, type TenureRunSummary } from './tenure-flow-api'
import { TenureFlowStartForm } from './TenureFlowStartForm'
import { TenureFlowTimeline } from './TenureFlowTimeline'
import { TenureFlowReviewButton } from './TenureFlowReviewButton'
import { TenureFlowMerge } from './TenureFlowMerge'
import { TenureFlowDrafts } from './TenureFlowDrafts'
import { TenureFlowRunList } from './TenureFlowRunList'
import { flowStateLabel, TenureFlowStateDot } from './tenure-flow-labels'
import { TenureWorkflowEditor } from '../../tenure-workflow/TenureWorkflowEditor'
import { startTenureTutorial } from '../../tenure-tutorial/tutorial-steps'
import { TenureTutorialOffer } from './TenureTutorialOffer'

const LIVE_POLL_MS = 2000
const IDLE_POLL_MS = 10000

/** Right-sidebar "Flows" panel: tenure orchestrated runs for the active workspace folder (DESIGN.md 36.23 M38). */
export default function TenureFlowPanel(): React.JSX.Element {
  const worktree = useActiveWorktree()
  const path = worktree?.path ?? null
  const [runs, setRuns] = useState<TenureRunSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<TenureRunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [editing, setEditing] = useState(false)
  // tenure: run whose progress the editor shows as a graph (DESIGN.md 36.32)
  const [graphRun, setGraphRun] = useState<string | null>(null)
  // Why: the start form re-reads the workflow list after the editor saves one.
  const [workflowsVersion, setWorkflowsVersion] = useState(0)

  const loadRuns = useCallback(async () => {
    if (!path) {
      return
    }
    try {
      const data = await tenureCall<{ runs: TenureRunSummary[] }>({
        method: 'GET',
        path: '/api/runs',
        query: { project: path }
      })
      setRuns(data.runs)
      setError(null)
    } catch {
      // Why: a folder the engine has never run in is simply "no flows yet", not an error.
      setRuns([])
    }
  }, [path])

  // Why: archived flows stay out of the way; the newest one still in the list opens by default.
  const runId = selected ?? runs?.find((r) => !r.archived_at)?.run_id ?? null
  const loadDetail = useCallback(async () => {
    if (!path || !runId) {
      setDetail(null)
      return
    }
    try {
      setDetail(
        await tenureCall<TenureRunDetail>({
          method: 'GET',
          path: '/api/run',
          query: { project: path, run: runId }
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [path, runId])

  useEffect(() => {
    setRuns(null)
    setSelected(null)
    setDetail(null)
    setStarting(false)
  }, [loadRuns])

  const live = !!detail?.live
  useEffect(() => {
    void loadDetail()
    // Why: while a flow runs only its detail changes quickly; the list summarises every run, so it
    // refreshes slowly, and nothing is polled while the window is hidden (DESIGN.md 36.38).
    const whenShown = (load: () => Promise<void>) => () => {
      if (!document.hidden) {
        void load()
      }
    }
    const fast = window.setInterval(whenShown(loadDetail), live ? LIVE_POLL_MS : IDLE_POLL_MS)
    const slow = window.setInterval(whenShown(loadRuns), IDLE_POLL_MS)
    return () => {
      window.clearInterval(fast)
      window.clearInterval(slow)
    }
  }, [loadDetail, loadRuns, live])

  // Why: a new folder, or a flow that just started or finished, changes the list; read it now.
  useEffect(() => {
    void loadRuns()
  }, [live, loadRuns])

  const act = async (actionPath: string, body: Record<string, unknown>) => {
    try {
      await tenureCall({ method: 'POST', path: actionPath, body })
      window.setTimeout(() => void loadDetail(), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!worktree || !path) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        {translate('tenure.flow.noWorkspace', 'Select a workspace to see its flows.')}
      </div>
    )
  }

  const showForm = starting || (runs !== null && runs.length === 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={path}>
          {worktree.displayName ?? path}
        </span>
        <Button
          variant="ghost"
          size="xs"
          title={translate('tenure.tutorial.open', 'Open the guide')}
          aria-label={translate('tenure.tutorial.button', 'Guide')}
          onClick={startTenureTutorial}
        >
          <GraduationCap className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          data-tenure-tour="workflow-button"
          title={translate('tenure.workflow.open', 'Edit workflows as nodes')}
          onClick={() => setEditing(true)}
        >
          <Workflow className="size-3" />
          {translate('tenure.workflow.button', 'Workflows')}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          data-tenure-tour="new-flow"
          onClick={() => setStarting((v) => !v)}
        >
          <Play className="size-3" />
          {translate('tenure.flow.new', 'New flow')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
        {error ? <div className="px-3 py-2 text-xs text-destructive">{error}</div> : null}
        {runs && runs.length === 0 ? <TenureTutorialOffer /> : null}
        {showForm ? (
          <TenureFlowStartForm
            path={path}
            workflowsVersion={workflowsVersion}
            onStarted={(id) => {
              setStarting(false)
              setSelected(id)
              void loadRuns()
            }}
            onCancel={runs && runs.length > 0 ? () => setStarting(false) : undefined}
          />
        ) : null}
        {runs ? (
          <TenureFlowRunList
            runs={runs}
            project={path}
            selected={runId}
            onSelect={setSelected}
            onChanged={(removed) => {
              if (removed && removed === runId) {
                setSelected(null)
                setDetail(null)
              }
              void loadRuns()
            }}
          />
        ) : null}
        {detail ? (
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <TenureFlowStateDot state={detail.live ? 'working' : detail.activity.state} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={detail.state.task}>
                  {detail.state.task.split('\n')[0]}
                </div>
                <div className="text-xs text-muted-foreground">{flowStateLabel(detail)}</div>
              </div>
              {detail.live ? (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void act('/api/actions/stop', { project: path, run: runId })}
                >
                  <Square className="size-3" />
                  {translate('tenure.flow.stop', 'Stop')}
                </Button>
              ) : detail.resume.possible ? (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void act('/api/actions/resume', { project: path, run: runId })}
                >
                  <RotateCw className="size-3" />
                  {translate('tenure.flow.resume', 'Resume')}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="xs"
                data-tenure-tour="graph"
                onClick={() => setGraphRun(runId)}
              >
                <Network className="size-3" />
                {translate('tenure.flow.graph', 'View as graph')}
              </Button>
              {detail.live ? null : (
                <TenureFlowReviewButton detail={detail} worktreeId={worktree.id} />
              )}
            </div>
            {detail.state.error && !detail.live ? (
              <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs">
                {detail.state.error}
              </div>
            ) : null}
            <TenureFlowMerge
              detail={detail}
              project={path}
              runId={runId!}
              onDone={() => {
                void loadDetail()
                void loadRuns()
              }}
            />
            {detail.state.race ? (
              <TenureFlowDrafts
                race={detail.state.race}
                project={path}
                runId={runId!}
                canPick={
                  !detail.live &&
                  (detail.state.status === 'done_approved' ||
                    detail.state.status === 'done_unapproved')
                }
                onPicked={() => void loadDetail()}
              />
            ) : null}
            <div data-tenure-tour="timeline">
              <TenureFlowTimeline
                detail={detail}
                project={path}
                runId={runId!}
                worktreeId={worktree.id}
              />
            </div>
          </div>
        ) : null}
      </div>
      <TenureWorkflowEditor
        open={editing || !!graphRun}
        run={graphRun}
        onOpenChange={(next) => {
          setEditing(next)
          if (!next) {
            setGraphRun(null)
          }
        }}
        project={path}
        onSaved={() => setWorkflowsVersion((v) => v + 1)}
      />
    </div>
  )
}
