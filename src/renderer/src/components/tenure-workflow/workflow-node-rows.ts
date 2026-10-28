import { translate } from '@/i18n/i18n'
import { checkLabel, outputLabel, slotLabel } from './workflow-labels'
import { FORK_HANDLE, NO_HANDLE, STEP_SLOTS, YES_HANDLE, type StepKind } from './workflow-model'

// tenure: rows of a step node (DESIGN.md 36.32). The node draws them and places each connector at
// its row's centre, so a line always meets its dot.

export const HEADER_H = 32
export const ROW_H = 26

export type NodeRow =
  | { type: 'slot'; key: string; label: string; optional: boolean }
  | { type: 'out'; key: string; label: string }
  | { type: 'value'; key: string; label: string; value: string }

/** Vertical centre of row `i` (0-based) inside the node, in px from the node's top edge. */
export function rowCenter(i: number): number {
  return HEADER_H + ROW_H * i + ROW_H / 2
}

export const HEADER_CENTER = HEADER_H / 2

function value(params: Record<string, unknown>, key: string): unknown {
  return params[key]
}

export function stepRows(kind: StepKind, params: Record<string, unknown>): NodeRow[] {
  const rows: NodeRow[] = STEP_SLOTS[kind].map((slot) => ({
    type: 'slot',
    key: slot.key,
    label: slotLabel(slot.key),
    optional: slot.min === 0
  }))
  if (kind === 'branch') {
    rows.push(
      {
        type: 'value',
        key: 'check',
        label: translate('tenure.workflow.param.check', 'Condition'),
        value: checkLabel(params.check)
      },
      { type: 'out', key: YES_HANDLE, label: outputLabel(YES_HANDLE) },
      { type: 'out', key: NO_HANDLE, label: outputLabel(NO_HANDLE) }
    )
  }
  if (kind === 'parallel') {
    rows.push({ type: 'out', key: FORK_HANDLE, label: outputLabel(FORK_HANDLE) })
  }
  const show = (key: string, label: string, text: (v: unknown) => string) => {
    const v = value(params, key)
    if (v !== undefined && v !== '') {
      rows.push({ type: 'value', key, label, value: text(v) })
    }
  }
  if (kind === 'build') {
    show('max_review', translate('tenure.workflow.row.maxReview', 'Max reviews'), (v) =>
      translate('tenure.workflow.row.times', '{{value0}}×', { value0: String(v) })
    )
    show('design', translate('tenure.workflow.param.design', 'Design source'), (v) =>
      v === 'task'
        ? translate('tenure.workflow.param.designTask', 'The task text itself')
        : translate('tenure.workflow.param.designDoc', 'DESIGN.md')
    )
  }
  if (kind === 'debate') {
    show('rounds', translate('tenure.workflow.row.rounds', 'Critique rounds'), (v) => String(v))
  }
  if (kind === 'continue') {
    rows.push({
      type: 'value',
      key: 'rounds',
      label: translate('tenure.workflow.row.moreRounds', 'More rounds'),
      value: String(value(params, 'rounds') ?? 1)
    })
  }
  show('max_visits', translate('tenure.workflow.row.maxVisits', 'Max repeats'), (v) => String(v))
  return rows
}
