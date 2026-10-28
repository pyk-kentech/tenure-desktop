import React, { useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import {
  Bot,
  Check,
  Code2,
  Columns2,
  MessagesSquare,
  RotateCcw,
  Search,
  ShieldCheck,
  Split,
  X,
  type LucideIcon
} from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  AGENT_COLOR,
  NEXT_HANDLE,
  PREV_HANDLE,
  ROLE_HANDLE,
  type RoleNode,
  type StepKind,
  type StepNode
} from './workflow-model'
import { kindHelp, kindLabel } from './workflow-labels'
import { HEADER_CENTER, HEADER_H, ROW_H, rowCenter, stepRows } from './workflow-node-rows'
import { statusLabel, type StepStatus } from './run-progress'

const KIND_ICON: Record<StepKind, LucideIcon> = {
  explore: Search,
  debate: MessagesSquare,
  build: Code2,
  audit: ShieldCheck,
  branch: Split,
  continue: RotateCcw,
  parallel: Columns2
}
const WORK_HEADER = 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200'
const CONTROL_HEADER = 'bg-muted text-foreground'
const AGENT_HEADER: Record<string, string> = {
  claude: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  codex: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200'
}
const OUT_DOT: Record<string, string> = {
  yes: '!bg-emerald-500',
  no: '!bg-rose-500',
  fork: '!bg-sky-500',
  next: '!bg-zinc-400'
}
const STATUS_RING: Record<StepStatus, string> = {
  pending: 'opacity-80',
  running: 'ring-2 ring-sky-500 ring-offset-2 ring-offset-background',
  done: 'ring-1 ring-emerald-500',
  failed: 'ring-2 ring-rose-500',
  skipped: 'opacity-45'
}
const dot = '!size-2.5 !border-2 !border-card'

function HoverCard({
  visible,
  title,
  children
}: {
  visible: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={10}>
      <div className="pointer-events-none w-64 rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
        <div className="mb-1 font-medium">{title}</div>
        {children}
      </div>
    </NodeToolbar>
  )
}

/** A role: which agent and model do the work. Its right connector goes into a step's slot. */
export function WorkflowRoleNode({ data, selected }: NodeProps<RoleNode>): React.JSX.Element {
  const { name, def } = data
  const [hover, setHover] = useState(false)
  const detail = [def.model, def.effort].filter(Boolean).join(' · ')
  return (
    <div
      className={`w-40 rounded-lg border bg-card text-xs shadow-sm ${selected ? 'ring-2 ring-ring' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`flex items-center gap-1.5 rounded-t-[7px] px-2.5 font-medium ${AGENT_HEADER[def.agent] ?? CONTROL_HEADER}`}
        style={{ height: HEADER_H }}
      >
        <Bot className="size-3.5 shrink-0" />
        <span className="truncate">{name}</span>
      </div>
      <div className="flex items-center px-2.5 text-muted-foreground" style={{ height: ROW_H }}>
        <span className="truncate">{[def.agent, detail].filter(Boolean).join(' · ')}</span>
      </div>
      <Handle
        type="source"
        id={ROLE_HANDLE}
        position={Position.Right}
        style={{ top: rowCenter(0), background: AGENT_COLOR[def.agent] }}
        className={dot}
      />
      <HoverCard visible={hover} title={name}>
        <div className="text-muted-foreground">
          {def.agent}
          {def.model ? ` · ${def.model}` : ''}
          {def.effort ? ` · ${def.effort}` : ''}
        </div>
        {def.instructions ? (
          <div className="mt-1 line-clamp-4 text-muted-foreground">{def.instructions}</div>
        ) : null}
      </HoverCard>
    </div>
  )
}

/**
 * A step. Left connectors take the previous step (header) and roles (rows); right connectors lead
 * on. In the run view the ring shows its status and hovering shows what happened there.
 */
export function WorkflowStepNode({ data, selected }: NodeProps<StepNode>): React.JSX.Element {
  const [hover, setHover] = useState(false)
  const rows = stepRows(data.kind, data.params)
  const Icon = KIND_ICON[data.kind]
  const control = data.kind === 'branch' || data.kind === 'parallel'
  const progress = data.progress
  return (
    <div
      className={`w-56 rounded-lg bg-card text-xs shadow-sm ${control ? 'border border-dashed border-foreground/30' : 'border'} ${
        progress ? STATUS_RING[progress.status] : ''
      } ${selected ? 'outline outline-2 outline-ring' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`flex items-center gap-1.5 rounded-t-[7px] px-2.5 font-medium ${control ? CONTROL_HEADER : WORK_HEADER}`}
        style={{ height: HEADER_H }}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{kindLabel(data.kind)}</span>
        {progress?.status === 'running' ? (
          <span className="size-2 animate-ping rounded-full bg-sky-500" />
        ) : null}
        {progress?.status === 'done' ? <Check className="size-3.5 text-emerald-600" /> : null}
        {progress?.status === 'failed' ? <X className="size-3.5 text-rose-600" /> : null}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center gap-2 px-2.5 text-muted-foreground ${row.type === 'value' ? 'border-t border-border/60' : ''}`}
          style={{ height: ROW_H }}
        >
          {row.type === 'out' ? (
            <span className="flex-1 text-right">{row.label}</span>
          ) : (
            <span className="flex-1 truncate">
              {row.label}
              {row.type === 'slot' && row.optional ? (
                <span className="ml-1 text-[10px] opacity-70">
                  {translate('tenure.workflow.optional', 'optional')}
                </span>
              ) : null}
            </span>
          )}
          {row.type === 'value' ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{row.value}</span>
          ) : null}
        </div>
      ))}
      <Handle
        type="target"
        id={PREV_HANDLE}
        position={Position.Left}
        style={{ top: HEADER_CENTER }}
        className={`${dot} !bg-zinc-400`}
      />
      {data.kind !== 'branch' ? (
        <Handle
          type="source"
          id={NEXT_HANDLE}
          position={Position.Right}
          style={{ top: HEADER_CENTER }}
          className={`${dot} ${OUT_DOT.next}`}
        />
      ) : null}
      {rows.map((row, i) =>
        row.type === 'slot' ? (
          <Handle
            key={row.key}
            type="target"
            id={row.key}
            position={Position.Left}
            style={{ top: rowCenter(i) }}
            className={`${dot} !bg-muted-foreground`}
          />
        ) : row.type === 'out' ? (
          <Handle
            key={row.key}
            type="source"
            id={row.key}
            position={Position.Right}
            style={{ top: rowCenter(i) }}
            className={`${dot} ${OUT_DOT[row.key] ?? ''}`}
          />
        ) : null
      )}
      <HoverCard visible={hover} title={kindLabel(data.kind)}>
        {progress ? (
          <>
            <div className="mb-1 text-muted-foreground">{statusLabel(progress.status)}</div>
            {progress.lines.length ? (
              progress.lines.map((line) => (
                <div key={line} className="leading-relaxed">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">
                {translate('tenure.progress.noRecord', 'No record yet.')}
              </div>
            )}
          </>
        ) : (
          <div className="leading-relaxed text-muted-foreground">{kindHelp(data.kind)}</div>
        )}
      </HoverCard>
    </div>
  )
}

export const WORKFLOW_NODE_TYPES = {
  tenureRole: WorkflowRoleNode,
  tenureStep: WorkflowStepNode
}
