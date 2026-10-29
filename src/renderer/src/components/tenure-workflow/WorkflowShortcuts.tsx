import React, { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'

// tenure: the editor's controls as a short list behind "?" (DESIGN.md 36.37 M52), instead of a long
// paragraph under the parts list.

function rows(): [string, string][] {
  return [
    [
      translate('tenure.workflow.keys.connectKey', 'Drag a dot'),
      translate('tenure.workflow.keys.connect', "Role's right dot → step slot; step → next step")
    ],
    [
      translate('tenure.workflow.keys.addKey', 'Double-click'),
      translate('tenure.workflow.keys.add', 'Search and add a node (or drop a line on empty space)')
    ],
    [
      translate('tenure.workflow.keys.cutKey', 'Hover a line → ×'),
      translate('tenure.workflow.keys.cut', 'Remove the line')
    ],
    [
      translate('tenure.workflow.keys.moveKey', 'Drag a line end'),
      translate('tenure.workflow.keys.move', 'Move it to another dot; on empty space it is cut')
    ],
    [
      translate('tenure.workflow.keys.tieKey', 'Hold Z + drag'),
      translate('tenure.workflow.keys.tie', 'Tie the lines you cross')
    ],
    [
      translate('tenure.workflow.keys.tieEditKey', 'Drag a tie'),
      translate('tenure.workflow.keys.tieEdit', 'Move it; Shift-drag turns it; double-click unties')
    ],
    [
      translate('tenure.workflow.keys.deleteKey', 'Delete'),
      translate('tenure.workflow.keys.delete', 'Delete the selected node or line')
    ],
    [
      translate('tenure.workflow.keys.undoKey', 'Ctrl+Z / Ctrl+Shift+Z'),
      translate('tenure.workflow.keys.undo', 'Undo / redo')
    ],
    [
      translate('tenure.workflow.keys.helpKey', '?'),
      translate('tenure.workflow.keys.help', 'Show or hide this list')
    ]
  ]
}

function typing(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  )
}

/** "?" toggles the list while the editor is open, except while typing in a field. */
export function useShortcutKey(active: boolean, toggle: () => void): void {
  useEffect(() => {
    if (!active) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !typing(e.target)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, toggle])
}

export function WorkflowShortcuts({
  open,
  onToggle
}: {
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  if (!open) {
    return (
      <button
        type="button"
        data-tenure-tour="editor-keys"
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground"
        title={translate('tenure.workflow.keys.open', 'Controls (?)')}
        onClick={onToggle}
      >
        <Keyboard className="size-3.5" />?
      </button>
    )
  }
  return (
    <div
      data-tenure-tour="editor-keys"
      data-open="true"
      className="absolute right-2 top-2 z-10 w-80 rounded-lg border bg-popover p-3 text-xs shadow-lg"
    >
      <div className="mb-2 flex items-center">
        <span className="flex-1 font-medium">
          {translate('tenure.workflow.keys.title', 'Controls')}
        </span>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={translate('tenure.workflow.keys.close', 'Close')}
          onClick={onToggle}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {rows().map(([key, what]) => (
          <React.Fragment key={key}>
            <dt className="whitespace-nowrap font-medium">{key}</dt>
            <dd className="text-muted-foreground">{what}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  )
}
