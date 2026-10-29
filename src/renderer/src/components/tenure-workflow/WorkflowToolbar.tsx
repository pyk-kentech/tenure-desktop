import React from 'react'
import { CheckCircle2, LayoutGrid, Redo2, Save, Undo2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import type { WorkflowListItem } from './workflow-editor-api'
import type { WireStyle } from './WorkflowEdges'
import type { SaveTarget } from './use-save-target'
import { workflowTitle } from './workflow-titles'

export type EditorStatus = { tone: 'ok' | 'error'; text: string }

const selectClass = 'h-8 rounded-md border bg-background px-2 text-xs'

/** Template pick, save name/place, tidy/check/save, and the last check result. */
export function WorkflowToolbar(props: {
  templates: WorkflowListItem[]
  template: string
  onTemplate: (id: string) => void
  target: SaveTarget
  description: string
  onDescription: (v: string) => void
  canProjectScope: boolean
  wire: WireStyle
  onWire: (v: WireStyle) => void
  onTidy: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCheck: () => void
  onSave: () => void
  status: EditorStatus | null
}): React.JSX.Element {
  const t = props.target
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2 pr-12">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          {translate('tenure.workflow.title', 'Workflow editor')}
        </span>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {translate('tenure.workflow.template', 'Start from')}
          <select
            className={selectClass}
            value={props.template}
            onChange={(e) => props.onTemplate(e.target.value)}
          >
            {props.templates.map((w) => (
              <option key={w.id} value={w.id}>
                {workflowTitle(w.id, w.name)}
                {w.source_label ? ` (${w.source_label})` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          {translate('tenure.workflow.wire.label', 'Lines')}
          <select
            className={selectClass}
            value={props.wire}
            onChange={(e) =>
              props.onWire(
                e.target.value === 'straight'
                  ? 'straight'
                  : e.target.value === 'step'
                    ? 'step'
                    : 'bezier'
              )
            }
          >
            <option value="bezier">{translate('tenure.workflow.wire.bezier', 'Curved')}</option>
            <option value="straight">
              {translate('tenure.workflow.wire.straight', 'Straight')}
            </option>
            <option value="step">{translate('tenure.workflow.wire.step', 'Right-angled')}</option>
          </select>
        </label>
        <Button
          variant="ghost"
          size="xs"
          disabled={!props.canUndo}
          aria-label={translate('tenure.workflow.undo', 'Undo (Ctrl+Z)')}
          title={translate('tenure.workflow.undo', 'Undo (Ctrl+Z)')}
          onClick={props.onUndo}
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={!props.canRedo}
          aria-label={translate('tenure.workflow.redo', 'Redo (Ctrl+Shift+Z)')}
          title={translate('tenure.workflow.redo', 'Redo (Ctrl+Shift+Z)')}
          onClick={props.onRedo}
        >
          <Redo2 className="size-3.5" />
        </Button>
        <Button variant="outline" size="xs" onClick={props.onTidy}>
          <LayoutGrid className="size-3" />
          {translate('tenure.workflow.tidy', 'Auto-arrange')}
        </Button>
        <Button variant="outline" size="xs" data-tenure-tour="editor-check" onClick={props.onCheck}>
          <CheckCircle2 className="size-3" />
          {translate('tenure.workflow.check', 'Check')}
        </Button>
        <Button size="xs" disabled={!t.title.trim()} onClick={props.onSave}>
          <Save className="size-3" />
          {translate('tenure.workflow.save', 'Save')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1 text-muted-foreground">
          {translate('tenure.workflow.saveTitle', 'Name')}
          <Input
            value={t.title}
            maxLength={80}
            onChange={(e) => t.setTitle(e.target.value)}
            className="h-8 w-48 text-xs"
          />
        </label>
        <select
          className={selectClass}
          value={t.scope}
          onChange={(e) => t.setScope(e.target.value === 'user' ? 'user' : 'project')}
        >
          {props.canProjectScope ? (
            <option value="project">
              {translate('tenure.workflow.scope.project', 'This project')}
            </option>
          ) : null}
          <option value="user">{translate('tenure.workflow.scope.user', 'My templates')}</option>
        </select>
        {t.ownFile ? (
          <label
            className="flex items-center gap-1 text-muted-foreground"
            title={translate('tenure.workflow.fileHint', 'File: {{value0}}.toml', {
              value0: t.ownFile
            })}
          >
            <Checkbox checked={!t.keepFile} onCheckedChange={(v) => t.setKeepFile(v !== true)} />
            {translate('tenure.workflow.saveAsNew', 'Save as a new workflow')}
          </label>
        ) : null}
        <Input
          value={props.description}
          onChange={(e) => props.onDescription(e.target.value)}
          placeholder={translate('tenure.workflow.description', 'Description')}
          className="h-8 min-w-40 flex-1 text-xs"
        />
      </div>
      {props.status ? (
        <div
          className={`whitespace-pre-wrap text-xs ${
            props.status.tone === 'ok' ? 'text-status-success' : 'text-destructive'
          }`}
        >
          {props.status.text}
        </div>
      ) : null}
    </div>
  )
}
