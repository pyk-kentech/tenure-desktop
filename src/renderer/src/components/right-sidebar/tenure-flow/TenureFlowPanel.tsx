import React, { useCallback, useEffect, useState } from 'react'
import { Play, Square, RotateCw } from 'lucide-react'
import { useActiveWorktree } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { tenureCall, type TenureRunDetail, type TenureRunSummary } from './tenure-flow-api'
import { TenureFlowStartForm } from './TenureFlowStartForm'
import { TenureFlowTimeline } from './TenureFlowTimeline'
import { TenureFlowReviewButton } from './TenureFlowReviewButton'
import { TenureFlowDrafts } from './TenureFlowDrafts'
import { flowStateLabel, TenureFlowStateDot } from './tenure-flow-labels'

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

  const runId = selected ?? runs?.[0]?.run_id ?? null
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
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    void loadDetail()
    const id = window.setInterval(
      () => {
        void loadDetail()
        void loadRuns()
      },
      detail?.live ? LIVE_POLL_MS : IDLE_POLL_MS
    )
    return () => window.clearInterval(id)
  }, [loadDetail, loadRuns, detail?.live])

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
        <Button variant="ghost" size="xs" onClick={() => setStarting((v) => !v)}>
          <Play className="size-3" />
          {translate('tenure.flow.new', 'New flow')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
        {error ? <div className="px-3 py-2 text-xs text-destructive">{error}</div> : null}
        {showForm ? (
          <TenureFlowStartForm
            path={path}
            onStarted={(id) => {
              setStarting(false)
              setSelected(id)
              void loadRuns()
            }}
            onCancel={runs && runs.length > 0 ? () => setStarting(false) : undefined}
          />
        ) : null}
        {runs && runs.length > 1 ? (
          <div className="flex flex-col border-b border-border py-1">
            {runs.slice(0, 8).map((run) => (
              <button
                key={run.run_id}
                type="button"
                onClick={() => setSelected(run.run_id)}
                className={`flex items-center gap-2 px-3 py-1 text-left text-xs hover:bg-accent/60 ${
                  run.run_id === runId ? 'bg-accent' : ''
                }`}
              >
                <TenureFlowStateDot
                  state={run.live ? 'working' : (run.activity?.state ?? 'idle')}
                />
                <span className="min-w-0 flex-1 truncate">{run.task.split('\n')[0]}</span>
                <span className="text-muted-foreground">{run.config?.workflow ?? ''}</span>
              </button>
            ))}
          </div>
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
            {detail.live ? null : (
              <TenureFlowReviewButton detail={detail} worktreeId={worktree.id} />
            )}
            {detail.state.error && !detail.live ? (
              <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs">
                {detail.state.error}
              </div>
            ) : null}
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
            <TenureFlowTimeline
              detail={detail}
              project={path}
              runId={runId!}
              worktreeId={worktree.id}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
