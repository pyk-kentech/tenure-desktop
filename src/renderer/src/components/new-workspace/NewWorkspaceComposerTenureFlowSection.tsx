import React from 'react'
import { translate } from '@/i18n/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { NewWorkspaceComposerTenureRelaySettings } from './NewWorkspaceComposerTenureRelaySettings'
import {
  DEFAULT_TENURE_RELAY_OPTIONS,
  type TenureRelayOptions
} from '../../../../shared/tenure-relay'

/**
 * tenure: start an orchestrated flow (implement → review → fix) in the new workspace, or a
 * coordinator + worker relay (DESIGN.md 36.24), using the note as the task. The two are exclusive.
 */
export function NewWorkspaceComposerTenureFlowSection({
  tenureFlow,
  onTenureFlowChange,
  tenureRelay,
  onTenureRelayChange,
  note,
  onNoteChange
}: {
  tenureFlow: boolean
  onTenureFlowChange: (value: boolean) => void
  tenureRelay: TenureRelayOptions | null
  onTenureRelayChange?: (value: TenureRelayOptions | null) => void
  note: string
  onNoteChange: (value: string) => void
}): React.JSX.Element {
  const relayOn = tenureRelay !== null
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={tenureFlow}
          onCheckedChange={(v) => {
            onTenureFlowChange(v === true)
            if (v === true) {
              onTenureRelayChange?.(null)
            }
          }}
        />
        {translate('tenure.flow.composer.toggle', 'Start a tenure flow instead of an agent')}
      </label>
      {onTenureRelayChange ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={relayOn}
            onCheckedChange={(v) => {
              onTenureRelayChange(v === true ? { ...DEFAULT_TENURE_RELAY_OPTIONS } : null)
              if (v === true) {
                onTenureFlowChange(false)
              }
            }}
          />
          {translate('tenure.relay.toggle', 'Start a coordinator + worker relay (two Codex)')}
        </label>
      ) : null}
      {relayOn && onTenureRelayChange ? (
        <NewWorkspaceComposerTenureRelaySettings
          value={tenureRelay}
          onChange={onTenureRelayChange}
        />
      ) : null}
      {tenureFlow || relayOn ? (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          placeholder={
            relayOn
              ? translate(
                  'tenure.relay.taskPlaceholder',
                  'What should be built or fixed? The coordinator splits it into rounds for the worker.'
                )
              : translate(
                  'tenure.flow.taskPlaceholder',
                  'What should be built or fixed? The agents implement, review and fix in rounds.'
                )
          }
        />
      ) : null}
    </div>
  )
}
