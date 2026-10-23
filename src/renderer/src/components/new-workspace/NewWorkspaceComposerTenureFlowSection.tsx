import React from 'react'
import { translate } from '@/i18n/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

/** tenure: start an orchestrated flow (implement → review → fix) in the new workspace, using the note as the task. */
export function NewWorkspaceComposerTenureFlowSection({
  tenureFlow,
  onTenureFlowChange,
  note,
  onNoteChange
}: {
  tenureFlow: boolean
  onTenureFlowChange: (value: boolean) => void
  note: string
  onNoteChange: (value: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={tenureFlow} onCheckedChange={(v) => onTenureFlowChange(v === true)} />
        {translate('tenure.flow.composer.toggle', 'Start a tenure flow instead of an agent')}
      </label>
      {tenureFlow ? (
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          placeholder={translate(
            'tenure.flow.taskPlaceholder',
            'What should be built or fixed? The agents implement, review and fix in rounds.'
          )}
        />
      ) : null}
    </div>
  )
}
