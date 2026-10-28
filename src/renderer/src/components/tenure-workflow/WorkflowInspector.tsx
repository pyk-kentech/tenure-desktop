import React, { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BRANCH_CHECKS,
  REVISIT_KINDS,
  isRoleNode,
  type RoleDef,
  type WorkflowNode
} from './workflow-model'
import { checkLabel, kindHelp, kindLabel } from './workflow-labels'

const ROLE_NAME_RE = /^[a-z][a-z0-9_]{0,23}$/
const AGENTS = ['claude', 'codex']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const selectClass = 'h-8 rounded-md border bg-background px-2 text-xs'

function RoleFields({
  name,
  def,
  onRename,
  onChange
}: {
  name: string
  def: RoleDef
  onRename: (name: string) => boolean
  onChange: (def: RoleDef) => void
}) {
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])
  const valid = ROLE_NAME_RE.test(draft)
  const set = (key: keyof RoleDef, value: string) =>
    onChange({ ...def, [key]: value.trim() ? value : undefined })
  return (
    <>
      <Field label={translate('tenure.workflow.field.roleName', 'Role name')}>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!valid || !onRename(draft)) {
              setDraft(name)
            }
          }}
          className="h-8 text-xs"
        />
        {!valid ? (
          <span className="text-2xs text-destructive">
            {translate(
              'tenure.workflow.field.roleNameRule',
              'Lowercase letters, digits and _; start with a letter.'
            )}
          </span>
        ) : null}
      </Field>
      <Field label={translate('tenure.workflow.field.agent', 'Agent')}>
        <select
          className={selectClass}
          value={def.agent}
          onChange={(e) => onChange({ ...def, agent: e.target.value })}
        >
          {AGENTS.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </Field>
      <Field label={translate('tenure.workflow.field.model', 'Model (empty: settings)')}>
        <Input
          value={def.model ?? ''}
          onChange={(e) => set('model', e.target.value)}
          className="h-8 text-xs"
        />
      </Field>
      <Field label={translate('tenure.workflow.field.effort', 'Effort (empty: settings)')}>
        <Input
          value={def.effort ?? ''}
          onChange={(e) => set('effort', e.target.value)}
          className="h-8 text-xs"
        />
      </Field>
      <Field label={translate('tenure.workflow.field.instructions', 'Extra instructions')}>
        <Textarea
          rows={6}
          value={def.instructions ?? ''}
          onChange={(e) => set('instructions', e.target.value)}
          className="text-xs"
        />
      </Field>
    </>
  )
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string
  value: unknown
  onChange: (v: number | undefined) => void
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="h-8 text-xs"
      />
    </Field>
  )
}

export function WorkflowInspector({
  node,
  onRenameRole,
  onChangeRole,
  onChangeStep,
  onDelete
}: {
  node: WorkflowNode | null
  onRenameRole: (id: string, name: string) => boolean
  onChangeRole: (id: string, def: RoleDef) => void
  onChangeStep: (id: string, params: Record<string, unknown>) => void
  onDelete: (id: string) => void
}): React.JSX.Element {
  if (!node) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        {translate(
          'tenure.workflow.inspector.empty',
          'Pick a node to change it. Drag from a dot to another dot to connect.'
        )}
      </div>
    )
  }
  if (isRoleNode(node)) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <RoleFields
          name={node.data.name}
          def={node.data.def}
          onRename={(name) => onRenameRole(node.id, name)}
          onChange={(def) => onChangeRole(node.id, def)}
        />
        <DeleteButton onClick={() => onDelete(node.id)} />
      </div>
    )
  }
  const { kind, params } = node.data
  const set = (key: string, value: unknown) => {
    const next = { ...params, [key]: value }
    if (value === undefined || value === '') {
      delete next[key]
    }
    onChangeStep(node.id, next)
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <div className="text-sm font-medium">{kindLabel(kind)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{kindHelp(kind)}</div>
      </div>
      {kind === 'branch' ? (
        <Field label={translate('tenure.workflow.param.check', 'Condition')}>
          <select
            className={selectClass}
            value={typeof params.check === 'string' ? params.check : 'approved'}
            onChange={(e) => set('check', e.target.value)}
          >
            {BRANCH_CHECKS.map((check) => (
              <option key={check} value={check}>
                {checkLabel(check)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {kind === 'continue' ? (
        <NumberField
          label={translate('tenure.workflow.param.moreRounds', 'More rounds (1-5)')}
          value={params.rounds}
          onChange={(v) => set('rounds', v)}
        />
      ) : null}
      {REVISIT_KINDS.has(kind) ? (
        <NumberField
          label={translate(
            'tenure.workflow.param.maxVisits',
            'Max repeats when a line loops back (1-5, empty: once)'
          )}
          value={params.max_visits}
          onChange={(v) => set('max_visits', v)}
        />
      ) : null}
      {kind === 'build' ? (
        <>
          <NumberField
            label={translate(
              'tenure.workflow.param.maxReview',
              'Max review rounds (empty: settings)'
            )}
            value={params.max_review}
            onChange={(v) => set('max_review', v)}
          />
          <Field label={translate('tenure.workflow.param.design', 'Design source')}>
            <select
              className={selectClass}
              value={typeof params.design === 'string' ? params.design : 'doc'}
              onChange={(e) => set('design', e.target.value === 'doc' ? undefined : e.target.value)}
            >
              <option value="doc">
                {translate('tenure.workflow.param.designDoc', 'DESIGN.md')}
              </option>
              <option value="task">
                {translate('tenure.workflow.param.designTask', 'The task text itself')}
              </option>
            </select>
          </Field>
        </>
      ) : null}
      {kind === 'debate' ? (
        <>
          <NumberField
            label={translate('tenure.workflow.param.rounds', 'Critique rounds (empty: settings)')}
            value={params.rounds}
            onChange={(v) => set('rounds', v)}
          />
          <Field label={translate('tenure.workflow.param.output', 'Output')}>
            <select
              className={selectClass}
              value={params.output === 'change' ? 'change' : 'design'}
              onChange={(e) => set('output', e.target.value === 'change' ? 'change' : undefined)}
            >
              <option value="design">
                {translate('tenure.workflow.param.outputDesign', 'Full design')}
              </option>
              <option value="change">
                {translate('tenure.workflow.param.outputChange', 'Change design')}
              </option>
            </select>
          </Field>
        </>
      ) : null}
      <DeleteButton onClick={() => onDelete(node.id)} />
    </div>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="xs" className="self-start text-destructive" onClick={onClick}>
      <Trash2 className="size-3" />
      {translate('tenure.workflow.delete', 'Delete')}
    </Button>
  )
}
