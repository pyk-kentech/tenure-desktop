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
  TENURE_RELAY_MAX_ROUNDS_LIMIT,
  type TenureRelayOptions
} from '../../../../shared/tenure-relay'
import {
  useCodexModelCatalog,
  type TenureRelayModel
} from '@/components/tenure-relay/use-codex-model-catalog'

// Why a sentinel: Radix Select reserves the empty string for "no value".
const KEEP_CONFIG = '__codex-config__'

/** The efforts a pick can use: the chosen model's own, or the account default model's for ''. */
function effortsFor(models: TenureRelayModel[], model: string): TenureRelayModel['efforts'] {
  const row = model
    ? models.find((candidate) => candidate.id === model)
    : models.find((candidate) => candidate.isDefault)
  return row?.efforts ?? []
}

function SideSettings({
  side,
  label,
  models,
  model,
  effort,
  onChange
}: {
  side: 'coordinator' | 'worker'
  label: string
  models: TenureRelayModel[]
  model: string
  effort: string
  onChange: (next: { model: string; effort: string }) => void
}): React.JSX.Element {
  const efforts = effortsFor(models, model)
  // A model typed in an earlier version or missing from this account's list stays selectable.
  const extraModel = model && !models.some((candidate) => candidate.id === model) ? model : null
  const extraEffort =
    effort && !efforts.some((candidate) => candidate.value === effort) ? effort : null
  const keepLabel = translate('tenure.relay.keepConfig', 'Codex setting')
  return (
    <div className="flex items-center gap-2" data-tenure-relay-side={side}>
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <Select
        value={model || KEEP_CONFIG}
        onValueChange={(value) => {
          const nextModel = value === KEEP_CONFIG ? '' : value
          const nextEfforts = effortsFor(models, nextModel)
          // Why reset: an effort the new model does not list would be clamped or refused by Codex.
          const keepsEffort = !effort || nextEfforts.some((choice) => choice.value === effort)
          onChange({ model: nextModel, effort: keepsEffort ? effort : '' })
        }}
      >
        <SelectTrigger size="sm" className="min-w-0 flex-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={KEEP_CONFIG}>{keepLabel}</SelectItem>
          {extraModel ? <SelectItem value={extraModel}>{extraModel}</SelectItem> : null}
          {models.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={effort || KEEP_CONFIG}
        onValueChange={(value) => onChange({ model, effort: value === KEEP_CONFIG ? '' : value })}
      >
        <SelectTrigger size="sm" className="w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={KEEP_CONFIG}>{keepLabel}</SelectItem>
          {extraEffort ? <SelectItem value={extraEffort}>{extraEffort}</SelectItem> : null}
          {efforts.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** tenure relay (DESIGN.md 36.25): models and efforts from the Codex account, optional round cap. */
export function NewWorkspaceComposerTenureRelaySettings({
  value,
  onChange
}: {
  value: TenureRelayOptions
  onChange: (value: TenureRelayOptions) => void
}): React.JSX.Element {
  const { models } = useCodexModelCatalog()
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
      <SideSettings
        side="coordinator"
        label={translate('tenure.relay.coordinator', 'Coordinator')}
        models={models}
        model={value.coordinatorModel}
        effort={value.coordinatorEffort}
        onChange={({ model, effort }) =>
          onChange({ ...value, coordinatorModel: model, coordinatorEffort: effort })
        }
      />
      <SideSettings
        side="worker"
        label={translate('tenure.relay.worker', 'Worker')}
        models={models}
        model={value.workerModel}
        effort={value.workerEffort}
        onChange={({ model, effort }) =>
          onChange({ ...value, workerModel: model, workerEffort: effort })
        }
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-14 shrink-0">{translate('tenure.relay.rounds', 'Max rounds')}</span>
        <Input
          type="number"
          min={1}
          max={TENURE_RELAY_MAX_ROUNDS_LIMIT}
          value={value.maxRounds ?? ''}
          placeholder={translate('tenure.relay.noCap', 'No cap')}
          onChange={(e) =>
            onChange({
              ...value,
              maxRounds: e.target.value.trim() === '' ? null : Number(e.target.value)
            })
          }
          className="h-8 w-24 text-xs"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {translate(
          'tenure.relay.hint',
          'The coordinator does not edit files. It opens a worker Codex beside itself, hands it each round and checks the result. Leave the task empty to give it the task, links and files in its own terminal. Stop the coordinator to stop the relay.'
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {translate(
          'tenure.relay.trustHint',
          'In a folder Codex has not seen, it first asks whether to trust the folder. Accept in the coordinator terminal and the relay carries on. tenure does not answer for you, because the answer is saved in your Codex settings.'
        )}
      </p>
    </div>
  )
}
