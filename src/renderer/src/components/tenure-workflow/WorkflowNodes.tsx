import React, { useState } from 'react'
import { Handle, NodeToolbar, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
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
  OUTPUT_COLOR,
  PREV_HANDLE,
  ROLE_HANDLE,
  type RoleNode,
  type StepKind,
  type StepNode
} from './workflow-model'
import { kindHelp, kindLabel } from './workflow-labels'
import {
  HANDLE_SIZE,
  HEADER_CENTER,
  HEADER_H,
  ROW_H,
  rowCenter,
  stepRows
} from './workflow-node-rows'
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
const STATUS_RING: Record<StepStatus, string> = {
  pending: 'opacity-80',
  running: 'ring-2 ring-sky-500 ring-offset-2 ring-offset-background',
  done: 'ring-1 ring-emerald-500',
  failed: 'ring-2 ring-rose-500',
  skipped: 'opacity-45'
}
const EMPTY_SLOT = '#a1a1aa'

/**
 * A connector like ComfyUI's: filled with its line's colour when connected, a ring when empty.
 * React Flow centres it on the node edge; WorkflowEdges aims each line at its centre.
 */
function socket(top: number, color: string, connected: boolean) {
  return {
    style: {
      top,
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      minWidth: 0,
      minHeight: 0,
      background: connected ? color : undefined,
      borderColor: connected ? undefined : color
    },
    className: connected ? '!border-2 !border-card' : '!border-2 !bg-card'
  }
}

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
        {...socket(
          rowCenter(0),
          AGENT_COLOR[def.agent] ?? EMPTY_SLOT,
          !!data.sockets?.[ROLE_HANDLE]
        )}
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
export function WorkflowStepNode({ id, data, selected }: NodeProps<StepNode>): React.JSX.Element {
  const [hover, setHover] = useState(false)
  const { updateNodeData } = useReactFlow()
  const collapsed = !!data.collapsed
  const rows = stepRows(data.kind, data.params)
  // Why: a collapsed node keeps every connector at header height so its lines stay attached.
  const rowTop = (i: number) => (collapsed ? HEADER_CENTER : rowCenter(i))
  const Icon = KIND_ICON[data.kind]
  const control = data.kind === 'branch' || data.kind === 'parallel'
  const progress = data.progress
  const sockets = data.sockets ?? {}
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
        <button
          type="button"
          className="nodrag -ml-1 rounded p-0.5 hover:bg-foreground/10"
          aria-label={
            collapsed
              ? translate('tenure.workflow.expand', 'Expand')
              : translate('tenure.workflow.collapse', 'Collapse')
          }
          onClick={() => updateNodeData(id, { collapsed: !collapsed })}
        >
          {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        </button>
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{kindLabel(data.kind)}</span>
        {progress?.status === 'running' ? (
          <span className="size-2 animate-ping rounded-full bg-sky-500" />
        ) : null}
        {progress?.status === 'done' ? <Check className="size-3.5 text-emerald-600" /> : null}
        {progress?.status === 'failed' ? <X className="size-3.5 text-rose-600" /> : null}
      </div>
      {(collapsed ? [] : rows).map((row) => (
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
        {...socket(HEADER_CENTER, OUTPUT_COLOR.next, !!sockets[PREV_HANDLE])}
      />
      {data.kind !== 'branch' ? (
        <Handle
          type="source"
          id={NEXT_HANDLE}
          position={Position.Right}
          {...socket(HEADER_CENTER, OUTPUT_COLOR.next, !!sockets[NEXT_HANDLE])}
        />
      ) : null}
      {rows.map((row, i) =>
        row.type === 'slot' ? (
          <Handle
            key={row.key}
            type="target"
            id={row.key}
            position={Position.Left}
            {...socket(rowTop(i), sockets[row.key] ?? EMPTY_SLOT, !!sockets[row.key])}
          />
        ) : row.type === 'out' ? (
          <Handle
            key={row.key}
            type="source"
            id={row.key}
            position={Position.Right}
            {...socket(rowTop(i), OUTPUT_COLOR[row.key] ?? EMPTY_SLOT, !!sockets[row.key])}
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
