import React from 'react'
import { translate } from '@/i18n/i18n'
import type { RoleDef } from './workflow-model'
import { useModelChoices, withCurrent } from './use-model-choices'

// tenure: a role's model and reasoning effort, picked from the engine's list (DESIGN.md 36.37 M52)
// instead of typed by hand. A value not in the list (set in a file) stays selectable.

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export const selectClass = 'h-8 rounded-md border bg-background px-2 text-xs'

export function ModelFields({ def, onChange }: { def: RoleDef; onChange: (def: RoleDef) => void }) {
  const choices = useModelChoices()
  const agent = def.agent === 'codex' ? 'codex' : 'claude'
  const list = choices?.[agent]
  const model = list?.models.find((m) => m.id === def.model)
  const models = withCurrent(
    (list?.models ?? []).map((m) => ({ id: m.id, label: m.label || m.id })),
    def.model
  )
  const efforts = withCurrent(
    (model?.efforts?.length ? model.efforts : (list?.efforts ?? [])).map((e) => ({
      id: e,
      label: e
    })),
    def.effort
  )
  const pick = (key: 'model' | 'effort', value: string) =>
    onChange({ ...def, [key]: value || undefined })
  return (
    <>
      <Field label={translate('tenure.workflow.field.modelPick', 'Model')}>
        <select
          className={selectClass}
          value={def.model ?? ''}
          onChange={(e) => pick('model', e.target.value)}
        >
          <option value="">
            {translate('tenure.workflow.field.fromSettings', 'As in settings')}
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={translate('tenure.workflow.field.effortPick', 'Reasoning effort')}>
        <select
          className={selectClass}
          value={def.effort ?? ''}
          onChange={(e) => pick('effort', e.target.value)}
        >
          <option value="">
            {translate('tenure.workflow.field.fromSettings', 'As in settings')}
          </option>
          {efforts.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}
