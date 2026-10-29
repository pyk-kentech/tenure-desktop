import React from 'react'
import { TriangleAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

/** tenure: asks before unsaved editor changes are thrown away (DESIGN.md 36.36 M51). */
export function WorkflowDiscardBar({
  onDiscard,
  onKeep
}: {
  onDiscard: () => void
  onKeep: () => void
}): React.JSX.Element {
  return (
    <div
      role="alertdialog"
      className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <TriangleAlert className="size-3.5 shrink-0" />
      <span className="flex-1">
        {translate(
          'tenure.workflow.unsaved.text',
          'There are unsaved changes. They will be lost if you continue.'
        )}
      </span>
      <Button variant="outline" size="xs" onClick={onKeep}>
        {translate('tenure.workflow.unsaved.keep', 'Keep editing')}
      </Button>
      <Button variant="destructive" size="xs" onClick={onDiscard}>
        {translate('tenure.workflow.unsaved.discard', 'Discard changes')}
      </Button>
    </div>
  )
}
