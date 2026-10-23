import React from 'react'
import { Repeat } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useTenureFlowState, type TenureFlowCardState } from '@/lib/tenure-flow-status-store'

const TONE: Record<TenureFlowCardState, string> = {
  working: 'text-agent-working border-agent-working/30',
  blocked: 'text-agent-question-text border-agent-question/30',
  failed: 'text-destructive border-destructive/30',
  'done-unseen': 'text-status-success border-status-success-border'
}

function label(state: TenureFlowCardState): string {
  switch (state) {
    case 'working':
      return translate('tenure.flow.card.working', 'Flow running')
    case 'blocked':
      return translate('tenure.flow.card.blocked', 'Flow needs you')
    case 'failed':
      return translate('tenure.flow.card.failed', 'Flow failed')
    case 'done-unseen':
      return translate('tenure.flow.card.done', 'Flow done')
  }
}

/** Sidebar card badge for the tenure flow state of this workspace folder (DESIGN.md 36.23 M38). */
export function WorktreeCardTenureBadge({ path }: { path: string }): React.JSX.Element | null {
  const state = useTenureFlowState(path)
  if (!state) {
    return null
  }
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center gap-1 rounded border px-1.5 text-3xs font-medium leading-none ${TONE[state]}`}
    >
      <Repeat className="size-2.5" />
      {label(state)}
    </span>
  )
}
