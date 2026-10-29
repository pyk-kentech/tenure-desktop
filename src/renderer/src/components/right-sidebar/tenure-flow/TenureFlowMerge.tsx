import React, { useCallback, useEffect, useState } from 'react'
import { Check, GitMerge, Trash2, TriangleAlert, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { tenureCall, type TenureRunDetail } from './tenure-flow-api'

// tenure: bring a finished flow's changes into the user's branch, or throw them away (DESIGN.md
// 36.36 M51). The engine checks readiness and does the git work; this shows its verdict.

type MergeCheck = {
  key: string
  level: 'block' | 'warn' | 'ok'
  label: string
  detail: string
}
type Readiness = {
  checks: MergeCheck[]
  files: string[]
  ahead: number
  can_merge: boolean
  tree: { branch: string; base_branch: string }
}

const FINISHED = new Set(['done_approved', 'done_unapproved', 'done_design'])

const LEVEL_ICON = {
  block: <X className="size-3 shrink-0 text-destructive" />,
  warn: <TriangleAlert className="size-3 shrink-0 text-amber-500" />,
  ok: <Check className="size-3 shrink-0 text-emerald-600" />
}

export function TenureFlowMerge({
  detail,
  project,
  runId,
  onDone
}: {
  detail: TenureRunDetail
  project: string
  runId: string
  onDone: () => void
}): React.JSX.Element | null {
  const tree = detail.worktree
  const open = tree?.status === 'open' && !detail.live
  const [ready, setReady] = useState<{ runId: string; data: Readiness } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const check = useCallback(async () => {
    try {
      const data = await tenureCall<Readiness>({
        method: 'GET',
        path: '/api/merge/check',
        query: { project, run: runId }
      })
      setReady({ runId, data })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }, [project, runId])

  useEffect(() => {
    if (open) {
      void check()
    }
  }, [open, check, detail.state.status])

  if (!tree) {
    // Why: flows started here run in the workspace itself (its own git worktree), so their
    // commits are already on the workspace branch; say so instead of offering a merge.
    return !detail.live && FINISHED.has(detail.state.status) ? (
      <div className="rounded border px-2 py-1.5 text-xs text-muted-foreground">
        {translate(
          'tenure.flow.merge.inPlace',
          "This flow ran in this workspace, so its changes are already committed on the workspace's branch. Check them with Review changes."
        )}
      </div>
    ) : null
  }
  if (tree.status === 'merged') {
    return (
      <div className="rounded border px-2 py-1.5 text-xs text-muted-foreground">
        <GitMerge className="mr-1 inline size-3 text-emerald-600" />
        {translate('tenure.flow.merge.merged', 'Brought into {{value0}} ({{value1}})', {
          value0: tree.base_branch,
          value1: (tree.merged_commit ?? '').slice(0, 7)
        })}
      </div>
    )
  }
  if (tree.status === 'discarded') {
    return (
      <div className="rounded border px-2 py-1.5 text-xs text-muted-foreground">
        {tree.patch
          ? translate(
              'tenure.flow.merge.discardedPatch',
              'Discarded. The changes were kept as {{value0}}',
              {
                value0: tree.patch
              }
            )
          : translate('tenure.flow.merge.discarded', 'Discarded.')}
      </div>
    )
  }
  if (!open) {
    return null
  }
  const data = ready && ready.runId === runId ? ready.data : null
  const run = async (path: string, body: Record<string, unknown>) => {
    setBusy(true)
    setMessage(null)
    try {
      await tenureCall({ method: 'POST', path, body: { project, run: runId, ...body } })
      onDone()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
      void check()
    } finally {
      setBusy(false)
      setConfirmDiscard(false)
    }
  }
  const shown = data?.checks.filter((c) => c.level !== 'ok') ?? []
  return (
    <div className="rounded border px-2 py-2 text-xs" data-tenure-tour="merge">
      <div className="mb-1 font-medium">
        {translate('tenure.flow.merge.title', 'Use the result')}
      </div>
      <div className="mb-1.5 text-muted-foreground">
        {!data
          ? translate('tenure.flow.merge.checking', 'Checking whether it can be merged…')
          : data.can_merge
            ? translate(
                'tenure.flow.merge.summary',
                '{{value0}} changed files from {{value1}} can go into {{value2}}.',
                {
                  value0: String(data.files.length),
                  value1: tree.branch,
                  value2: tree.base_branch
                }
              )
            : translate(
                'tenure.flow.merge.blocked',
                '{{value0}} changed files from {{value1}} cannot go into {{value2}} yet. Sort out the items below first.',
                {
                  value0: String(data.files.length),
                  value1: tree.branch,
                  value2: tree.base_branch
                }
              )}
      </div>
      {shown.length ? (
        <div className="mb-1.5 space-y-0.5">
          {shown.map((c) => (
            <div key={c.key} className="flex items-start gap-1">
              <span className="mt-0.5">{LEVEL_ICON[c.level]}</span>
              <span>
                {c.label}
                {c.detail ? <span className="text-muted-foreground"> · {c.detail}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {message ? <div className="mb-1.5 text-destructive">{message}</div> : null}
      {confirmDiscard ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {translate(
              'tenure.flow.merge.confirmDiscard',
              'Discard these changes? They are kept as a patch file.'
            )}
          </span>
          <Button
            variant="destructive"
            size="xs"
            disabled={busy}
            onClick={() => void run('/api/actions/discard', {})}
          >
            {translate('tenure.flow.merge.discard', 'Discard')}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setConfirmDiscard(false)}>
            {translate('tenure.flow.merge.cancel', 'Cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            disabled={busy || !data?.can_merge}
            onClick={() => void run('/api/actions/merge', { mode: 'squash' })}
          >
            <GitMerge className="size-3" />
            {translate('tenure.flow.merge.apply', 'Bring into my branch')}
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => setConfirmDiscard(true)}
          >
            <Trash2 className="size-3" />
            {translate('tenure.flow.merge.discard', 'Discard')}
          </Button>
        </div>
      )}
    </div>
  )
}
