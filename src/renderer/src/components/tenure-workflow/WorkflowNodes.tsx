import React from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { translate } from '@/i18n/i18n'
import {
  NEXT_HANDLE,
  PREV_HANDLE,
  ROLE_HANDLE,
  STEP_SLOTS,
  type RoleNode,
  type StepNode
} from './workflow-model'
import { kindLabel, slotLabel } from './workflow-labels'

const AGENT_TINT: Record<string, string> = {
  claude: 'border-l-orange-400',
  codex: 'border-l-emerald-500'
}

/** A role: which agent/model does the work. Its top dot connects to a step's slot. */
export function WorkflowRoleNode({ data, selected }: NodeProps<RoleNode>): React.JSX.Element {
  const { name, def } = data
  return (
    <div
      className={`min-w-40 rounded-md border border-l-4 bg-card px-3 py-2 text-xs shadow-sm ${
        AGENT_TINT[def.agent] ?? ''
      } ${selected ? 'ring-2 ring-ring' : ''}`}
    >
      <Handle
        type="source"
        id={ROLE_HANDLE}
        position={Position.Top}
        className="!size-3 !border-2 !border-background !bg-foreground"
      />
      <div className="font-medium">{name}</div>
      <div className="text-muted-foreground">
        {def.agent}
        {def.model ? ` · ${def.model}` : ''}
        {def.effort ? ` · ${def.effort}` : ''}
      </div>
      {def.instructions ? (
        <div className="mt-1 text-2xs text-muted-foreground">
          {translate('tenure.workflow.hasInstructions', 'Has instructions')}
        </div>
      ) : null}
    </div>
  )
}

function paramSummary(kind: StepNode['data']['kind'], params: Record<string, unknown>): string {
  const parts: string[] = []
  if (kind === 'build' && params.max_review !== undefined) {
    parts.push(
      translate('tenure.workflow.param.maxReviewShort', 'up to {{value0}} reviews', {
        value0: String(params.max_review)
      })
    )
  }
  if (kind === 'build' && params.design === 'task') {
    parts.push(translate('tenure.workflow.param.designTaskShort', 'task as design'))
  }
  if (kind === 'debate' && params.rounds !== undefined) {
    parts.push(
      translate('tenure.workflow.param.roundsShort', '{{value0}} critique rounds', {
        value0: String(params.rounds)
      })
    )
  }
  return parts.join(' · ')
}

/** A step: what happens, in order. Left/right dots chain the steps; bottom dots take roles. */
export function WorkflowStepNode({ data, selected }: NodeProps<StepNode>): React.JSX.Element {
  const slots = STEP_SLOTS[data.kind]
  const summary = paramSummary(data.kind, data.params)
  return (
    <div
      className={`w-60 rounded-md border bg-card text-xs shadow-sm ${
        selected ? 'ring-2 ring-ring' : ''
      }`}
    >
      <Handle
        type="target"
        id={PREV_HANDLE}
        position={Position.Left}
        className="!size-3 !border-2 !border-background !bg-primary"
      />
      <Handle
        type="source"
        id={NEXT_HANDLE}
        position={Position.Right}
        className="!size-3 !border-2 !border-background !bg-primary"
      />
      <div className="border-b px-3 py-2">
        <div className="text-sm font-medium">{kindLabel(data.kind)}</div>
        {summary ? <div className="text-muted-foreground">{summary}</div> : null}
      </div>
      <div className="relative flex justify-around px-1 pb-3 pt-2">
        {slots.map((slot) => (
          <div key={slot.key} className="text-center text-2xs text-muted-foreground">
            {slotLabel(slot.key)}
            {slot.min === 0 ? (
              <div className="text-[10px]">{translate('tenure.workflow.optional', 'optional')}</div>
            ) : null}
          </div>
        ))}
        {slots.map((slot, i) => (
          <Handle
            key={slot.key}
            type="target"
            id={slot.key}
            position={Position.Bottom}
            style={{ left: `${((i + 0.5) / slots.length) * 100}%` }}
            className="!size-3 !border-2 !border-background !bg-muted-foreground"
          />
        ))}
      </div>
    </div>
  )
}

export const WORKFLOW_NODE_TYPES = {
  tenureRole: WorkflowRoleNode,
  tenureStep: WorkflowStepNode
}
