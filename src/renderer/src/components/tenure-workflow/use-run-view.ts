import { useCallback, useEffect, useState } from 'react'
import { tenureCall } from '../right-sidebar/tenure-flow/tenure-flow-api'
import { getWorkflow } from './workflow-editor-api'
import type { CurrentCall, RunStateLike } from './run-progress'
import type { WorkflowDef } from './workflow-model'

// tenure: the editor's run view (DESIGN.md 36.32). Loads the workflow a run used and re-reads the
// run every two seconds while it is live.

export type RunViewDetail = {
  live: boolean
  current_call: CurrentCall
  state: RunStateLike & { task: string; workflow?: WorkflowDef | null }
}

const POLL_MS = 2000

export function useRunView({
  open,
  project,
  runId,
  onLoad,
  onError
}: {
  open: boolean
  project: string | null
  runId: string | null | undefined
  onLoad: (def: WorkflowDef) => void
  onError: (message: string) => void
}): {
  detail: RunViewDetail | null
  active: boolean
  exit: () => void
  reset: () => void
} {
  // Why: results are keyed by run id so a different run never shows the previous run's state.
  const [loaded, setLoaded] = useState<{ runId: string; detail: RunViewDetail } | null>(null)
  const [leftRun, setLeftRun] = useState<string | null>(null)
  const active = !!runId && !!project && leftRun !== runId

  useEffect(() => {
    if (!open || !active || !project || !runId) {
      return
    }
    let alive = true
    let timer: number | undefined
    const read = async (first: boolean) => {
      try {
        const d = await tenureCall<RunViewDetail>({
          method: 'GET',
          path: '/api/run',
          query: { project, run: runId }
        })
        if (!alive) {
          return
        }
        setLoaded({ runId, detail: d })
        if (first) {
          // Why: classic runs keep no saved workflow; the engine builds it from settings.
          onLoad(d.state.workflow ?? (await getWorkflow(project, 'classic')).definition)
        }
        if (d.live) {
          timer = window.setTimeout(() => void read(false), POLL_MS)
        }
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e))
      }
    }
    void read(true)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [open, active, project, runId, onLoad, onError])

  const exit = useCallback(() => setLeftRun(runId ?? null), [runId])
  const reset = useCallback(() => {
    setLeftRun(null)
    setLoaded(null)
  }, [])
  return {
    detail: loaded && loaded.runId === runId ? loaded.detail : null,
    active,
    exit,
    reset
  }
}
