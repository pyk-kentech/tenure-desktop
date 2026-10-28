import React from 'react'
import { translate } from '@/i18n/i18n'
import type { TenureRunDetail } from './tenure-flow-api'

const DOT: Record<string, string> = {
  working: 'border-2 border-agent-working/30 border-t-agent-working animate-spin',
  blocked: 'bg-agent-question',
  failed: 'bg-destructive',
  'done-unseen': 'bg-status-success',
  unverifiable: 'border border-dashed border-agent-working'
}

export function TenureFlowStateDot({ state }: { state: string }): React.JSX.Element {
  return (
    <span
      className={`mt-1 inline-block size-2.5 shrink-0 rounded-full ${DOT[state] ?? 'bg-muted-foreground/40'}`}
      aria-label={state}
    />
  )
}

export function stepLabel(step: string): string {
  switch (step) {
    case 'implement':
      return translate('tenure.flow.step.implement', 'Implement')
    case 'review':
      return translate('tenure.flow.step.review', 'Review')
    case 'fix':
      return translate('tenure.flow.step.fix', 'Fix')
    case 'test':
      return translate('tenure.flow.step.test', 'Test')
    case 'design':
    case 'debate':
      return translate('tenure.flow.step.design', 'Design')
    case 'report':
      return translate('tenure.flow.step.report', 'Summary')
    case 'propose':
      return translate('tenure.flow.step.propose', 'Propose')
    case 'critique':
      return translate('tenure.flow.step.critique', 'Critique')
    case 'synthesize':
      return translate('tenure.flow.step.synthesize', 'Synthesise')
    case 'rereview':
      return translate('tenure.flow.step.rereview', 'Re-review')
    case 'audit':
      return translate('tenure.flow.step.audit', 'Audit')
    case 'explore':
      return translate('tenure.flow.step.explore', 'Explore')
    default:
      return step
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return translate('tenure.flow.status.running', 'Running')
    case 'done_approved':
      return translate('tenure.flow.status.approved', 'Approved')
    case 'done_unapproved':
      return translate('tenure.flow.status.unapproved', 'Not approved')
    case 'failed':
      return translate('tenure.flow.status.failed', 'Failed')
    case 'stopped':
      return translate('tenure.flow.status.stopped', 'Stopped')
    default:
      return status
  }
}

export function flowStateLabel(detail: TenureRunDetail): string {
  const st = detail.state
  const parts = [statusLabel(detail.live ? 'running' : st.status)]
  if (st.workflow?.name) {
    parts.push(st.workflow.name)
  }
  if (detail.live && detail.current_call) {
    parts.push(`${detail.current_call.agent} · ${stepLabel(detail.current_call.step)}`)
  } else if (st.round) {
    parts.push(translate('tenure.flow.round', 'Round {{value0}}', { value0: st.round }))
  }
  return parts.join(' · ')
}
