import React, { useState } from 'react'
import { FileDiff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { TenureRunDetail } from './tenure-flow-api'

/**
 * tenure: opens what the flow changed (its base commit → HEAD) in Orca's combined diff tab,
 * with the file tree, viewed marks and split view (DESIGN.md 36.28).
 */
export function TenureFlowReviewButton({
  detail,
  worktreeId
}: {
  detail: TenureRunDetail
  worktreeId: string
}): React.JSX.Element | null {
  const openBranchAllDiffs = useAppStore((s) => s.openBranchAllDiffs)
  const [busy, setBusy] = useState(false)
  const base = detail.state.base_commit
  if (!base || detail.state.race) {
    return null
  }
  const open = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.git.branchCompare({
        worktreePath: detail.project,
        baseRef: base
      })
      if (result.summary.status !== 'ready') {
        toast.error(result.summary.errorMessage ?? result.summary.status)
        return
      }
      if (result.entries.length === 0) {
        toast.info(translate('tenure.flow.reviewEmpty', 'No files changed since the flow started.'))
        return
      }
      const task = detail.state.task.split('\n')[0].slice(0, 40)
      openBranchAllDiffs(worktreeId, detail.project, result.summary, undefined, {
        entriesSnapshot: result.entries,
        label: translate('tenure.flow.reviewTab', 'tenure: {{value0}}', { value0: task })
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex">
      <Button variant="outline" size="xs" disabled={busy} onClick={() => void open()}>
        <FileDiff className="size-3" />
        {translate('tenure.flow.review', 'Review changes')}
      </Button>
    </div>
  )
}
