import React from 'react'
import { Plus } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { BLOCK_KINDS, CONTROL_KINDS, type StepKind } from './workflow-model'
import { kindHelp, kindLabel } from './workflow-labels'

function PaletteButton({
  label,
  help,
  onClick
}: {
  label: string
  help: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={help}
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
    >
      <Plus className="size-3 shrink-0 text-muted-foreground" />
      {label}
    </button>
  )
}

/** Parts list: add roles (who) and steps (what happens). */
export function WorkflowPalette({
  onAddRole,
  onAddStep
}: {
  onAddRole: (agent: 'claude' | 'codex') => void
  onAddStep: (kind: StepKind) => void
}): React.JSX.Element {
  return (
    <div className="flex w-48 shrink-0 flex-col gap-3 overflow-y-auto border-r p-2 scrollbar-sleek">
      <div>
        <div className="px-2 pb-1 text-2xs font-medium uppercase text-muted-foreground">
          {translate('tenure.workflow.palette.roles', 'Roles (who)')}
        </div>
        <PaletteButton
          label={translate('tenure.workflow.palette.claude', 'Claude role')}
          help={translate(
            'tenure.workflow.palette.roleHelp',
            'An agent with its own model and instructions.'
          )}
          onClick={() => onAddRole('claude')}
        />
        <PaletteButton
          label={translate('tenure.workflow.palette.codex', 'Codex role')}
          help={translate(
            'tenure.workflow.palette.roleHelp',
            'An agent with its own model and instructions.'
          )}
          onClick={() => onAddRole('codex')}
        />
      </div>
      <div>
        <div className="px-2 pb-1 text-2xs font-medium uppercase text-muted-foreground">
          {translate('tenure.workflow.palette.steps', 'Steps (what)')}
        </div>
        {BLOCK_KINDS.map((kind) => (
          <PaletteButton
            key={kind}
            label={kindLabel(kind)}
            help={kindHelp(kind)}
            onClick={() => onAddStep(kind)}
          />
        ))}
      </div>
      <div data-tenure-tour="editor-controls">
        <div className="px-2 pb-1 text-2xs font-medium uppercase text-muted-foreground">
          {translate('tenure.workflow.palette.controls', 'Control (branch, repeat)')}
        </div>
        {CONTROL_KINDS.map((kind) => (
          <PaletteButton
            key={kind}
            label={kindLabel(kind)}
            help={kindHelp(kind)}
            onClick={() => onAddStep(kind)}
          />
        ))}
      </div>
      <div className="mt-auto px-2 text-2xs leading-relaxed text-muted-foreground">
        {translate(
          'tenure.workflow.palette.hint',
          "Drag a role's right connector onto a step's slot. Double-click empty space, or drop a line there, to search and add a node. To fix a line, hover it and press ×, or drag its end to another connector (empty space cuts it)."
        )}
      </div>
    </div>
  )
}
