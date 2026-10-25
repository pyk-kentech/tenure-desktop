import React from 'react'
import { translate } from '@/i18n/i18n'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  TENURE_RELAY_EFFORTS,
  TENURE_RELAY_MAX_ROUNDS_LIMIT,
  type TenureRelayEffort,
  type TenureRelayOptions
} from '../../../../shared/tenure-relay'

// Why a sentinel: Radix Select reserves the empty string for "no value".
const KEEP_CONFIG = 'config'

function effortLabel(effort: TenureRelayEffort): string {
  return effort === '' ? translate('tenure.relay.effortConfig', 'Codex setting') : effort
}

function SideSettings({
  label,
  model,
  effort,
  onModelChange,
  onEffortChange
}: {
  label: string
  model: string
  effort: TenureRelayEffort
  onModelChange: (value: string) => void
  onEffortChange: (value: TenureRelayEffort) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <Input
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        placeholder={translate('tenure.relay.modelPlaceholder', 'Model (empty = Codex setting)')}
        className="h-8 text-xs"
      />
      <Select
        value={effort === '' ? KEEP_CONFIG : effort}
        onValueChange={(v) => onEffortChange(v === KEEP_CONFIG ? '' : (v as TenureRelayEffort))}
      >
        <SelectTrigger size="sm" className="w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TENURE_RELAY_EFFORTS.map((value) => (
            <SelectItem key={value || KEEP_CONFIG} value={value || KEEP_CONFIG}>
              {effortLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** tenure relay (DESIGN.md 36.24): models, efforts and the round cap for coordinator and worker. */
export function NewWorkspaceComposerTenureRelaySettings({
  value,
  onChange
}: {
  value: TenureRelayOptions
  onChange: (value: TenureRelayOptions) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
      <SideSettings
        label={translate('tenure.relay.coordinator', 'Coordinator')}
        model={value.coordinatorModel}
        effort={value.coordinatorEffort}
        onModelChange={(coordinatorModel) => onChange({ ...value, coordinatorModel })}
        onEffortChange={(coordinatorEffort) => onChange({ ...value, coordinatorEffort })}
      />
      <SideSettings
        label={translate('tenure.relay.worker', 'Worker')}
        model={value.workerModel}
        effort={value.workerEffort}
        onModelChange={(workerModel) => onChange({ ...value, workerModel })}
        onEffortChange={(workerEffort) => onChange({ ...value, workerEffort })}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-14 shrink-0">{translate('tenure.relay.rounds', 'Max rounds')}</span>
        <Input
          type="number"
          min={1}
          max={TENURE_RELAY_MAX_ROUNDS_LIMIT}
          value={value.maxRounds}
          onChange={(e) => onChange({ ...value, maxRounds: Number(e.target.value) })}
          className="h-8 w-20 text-xs"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {translate(
          'tenure.relay.hint',
          'The coordinator does not edit files. It opens a worker Codex beside itself, hands it each round and checks the result. Stop the coordinator to stop the relay.'
        )}
      </p>
    </div>
  )
}
