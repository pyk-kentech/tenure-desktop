import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { translate } from '@/i18n/i18n'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { WorkflowCanvas } from './WorkflowCanvas'
import { loadWireStyle, saveWireStyle } from './wire-style'
import { WorkflowRunBanner } from './WorkflowRunBanner'
import { useRunView } from './use-run-view'
import { runProgress } from './run-progress'
import { displayGraph, stepRefs } from './graph-display'
import { useWorkflowTies } from './use-workflow-ties'
import { tieRoutes } from './workflow-ties'
import { useRunEvents } from './use-run-events'
import { stepTimelines, withTimelines } from './step-timeline'
import { WorkflowRunPanel } from './WorkflowRunPanel'
import { WorkflowInspector } from './WorkflowInspector'
import { WorkflowPalette } from './WorkflowPalette'
import { WorkflowToolbar, type EditorStatus } from './WorkflowToolbar'
import { useWorkflowGraph } from './use-workflow-graph'
import { fromGraph } from './workflow-convert'
import { isStepNode, type WorkflowDef } from './workflow-model'
import { getWorkflow, listWorkflows, type WorkflowListItem } from './workflow-editor-api'
import { useSaveTarget } from './use-save-target'
import { checkCurrent, saveCurrent } from './workflow-save'
import { useEditHistory, useUndoKeys, type EditSnapshot } from './use-edit-history'
import { WorkflowDiscardBar } from './WorkflowDiscardBar'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * tenure: ComfyUI-style editor for engine workflows (DESIGN.md 36.29 M44). Roles and steps are
 * nodes; a role's dot goes into a step's slot, steps chain left to right. The engine validates.
 */
export function TenureWorkflowEditor({
  open,
  onOpenChange,
  project,
  initial,
  run,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: string | null
  initial?: string
  // tenure: open a run's workflow with its progress on top (DESIGN.md 36.32)
  run?: string | null
  onSaved?: (id: string) => void
}): React.JSX.Element {
  const graph = useWorkflowGraph()
  const ties = useWorkflowTies(graph.edges)
  const [templates, setTemplates] = useState<WorkflowListItem[]>([])
  const [template, setTemplate] = useState(initial ?? 'quick')
  const target = useSaveTarget(project)
  const { fromTemplate, fromRun } = target
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<EditorStatus | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewKey, setViewKey] = useState(0)
  const [wire, setWire] = useState(loadWireStyle)
  const { load, restore } = graph
  const resetTies = ties.reset
  const [pending, setPending] = useState<(() => void) | null>(null)
  const restoreSnap = useCallback(
    (snap: EditSnapshot) => {
      restore(snap.nodes, snap.edges)
      resetTies(snap.ties)
    },
    [restore, resetTies]
  )
  const history = useEditHistory(
    { nodes: graph.nodes, edges: graph.edges, ties: ties.ties },
    open,
    restoreSnap
  )
  const resetHistory = history.reset
  const loadRunDef = useCallback(
    (def: WorkflowDef) => {
      resetHistory()
      resetTies(load(def))
      fromRun(def.name || 'run')
      setDescription(def.description ?? '')
      setViewKey((k) => k + 1)
    },
    [load, resetTies, resetHistory, fromRun]
  )
  const onRunError = useCallback((text: string) => setStatus({ tone: 'error', text }), [])
  const runView = useRunView({ open, project, runId: run, onLoad: loadRunDef, onError: onRunError })

  const loadTemplate = useCallback(
    async (id: string) => {
      setStatus(null)
      setSelectedId(null)
      try {
        const res = await getWorkflow(project, id)
        resetHistory()
        resetTies(load(res.definition))
        setTemplate(id)
        fromTemplate(id, res.source, res.definition.name)
        setDescription(res.definition.description)
        setViewKey((k) => k + 1)
      } catch (e) {
        setStatus({ tone: 'error', text: errorText(e) })
      }
    },
    [project, load, resetTies, resetHistory, fromTemplate]
  )

  const loadList = useCallback(() => {
    listWorkflows(project)
      .then((items) => setTemplates(items.filter((w) => w.source !== 'error')))
      .catch((e: unknown) => setStatus({ tone: 'error', text: errorText(e) }))
  }, [project])

  useEffect(() => {
    if (!open) {
      return
    }
    loadList()
    if (!run) {
      void loadTemplate(initial ?? 'quick')
    }
  }, [open, initial, run, loadTemplate, loadList])

  const current = () =>
    fromGraph(
      graph.nodes,
      graph.edges,
      { name: target.title.trim() || template, description },
      ties.ties
    )

  const runCheck = async (): Promise<boolean> => {
    const res = await checkCurrent(project, current())
    setStatus(res.status)
    return res.ok
  }

  const runSave = async () => {
    if (!(await runCheck())) {
      return
    }
    const res = await saveCurrent({
      project,
      title: target.title.trim(),
      fileId: target.fileId,
      scope: target.scope,
      def: current().def
    })
    setStatus(res.status)
    if (res.id) {
      history.markSaved()
      target.saved(res.id)
      setTemplate(res.id)
      loadList()
      onSaved?.(res.id)
    }
  }

  // Why: unsaved edits are only thrown away after the user says so (DESIGN.md 36.36 M51).
  const guard = (fn: () => void) => (history.dirty && !runView.active ? setPending(() => fn) : fn())
  useUndoKeys(open && !runView.active && !pending, history.undo, history.redo)

  const detail = runView.active ? runView.detail : null
  const events = useRunEvents(project, run ?? null, !!detail?.live, runView.active)
  const progress = useMemo(() => {
    if (!detail) {
      return null
    }
    const refs = stepRefs(graph.nodes, graph.edges)
    const base = runProgress(refs, detail.state, detail.live)
    return withTimelines(base, stepTimelines(events, refs))
  }, [detail, graph.nodes, graph.edges, events])
  const shown = useMemo(
    () =>
      displayGraph(
        graph.nodes,
        graph.edges,
        progress,
        detail?.state.graph?.decisions,
        wire,
        !runView.active,
        tieRoutes(ties.ties)
      ),
    [graph.nodes, graph.edges, progress, detail, wire, runView.active, ties.ties]
  )
  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null
  const runStep = runView.active ? shown.nodes.find((n) => n.id === selectedId) : undefined
  const dark = document.documentElement.classList.contains('dark')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true)
          return
        }
        guard(() => {
          setPending(null)
          runView.reset()
          onOpenChange(false)
        })
      }}
    >
      <DialogContent
        // Why: React Flow measures every connector while the dialog opens. The default zoom-in
        // scaled it to 95% then, so each line ended a little above and left of its dot; fade only.
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100"
        // Why: Esc in the add-node search box closes only the box, not the editor.
        onEscapeKeyDown={(e) => {
          if (e.target instanceof Element && e.target.closest('[data-tenure-tour="add-menu"]')) {
            e.preventDefault()
          }
        }}
        // Why: the walkthrough card sits outside the dialog; clicking it must not close the editor.
        onInteractOutside={(e) => {
          if (e.target instanceof Element && e.target.closest('[data-tenure-tutorial]')) {
            e.preventDefault()
          }
        }}
      >
        <DialogTitle className="sr-only">
          {translate('tenure.workflow.title', 'Workflow editor')}
        </DialogTitle>
        {runView.active ? (
          <WorkflowRunBanner detail={runView.detail} onEdit={runView.exit} />
        ) : (
          <WorkflowToolbar
            templates={templates}
            template={template}
            onTemplate={(id) => guard(() => void loadTemplate(id))}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
            target={target}
            description={description}
            onDescription={setDescription}
            canProjectScope={!!project}
            wire={wire}
            onWire={(next) => {
              setWire(next)
              saveWireStyle(next)
            }}
            onTidy={() => {
              graph.tidy()
              setViewKey((k) => k + 1)
            }}
            onCheck={() => void runCheck()}
            onSave={() => void runSave()}
            status={status}
          />
        )}
        {pending ? (
          <WorkflowDiscardBar
            onDiscard={() => {
              const fn = pending
              setPending(null)
              fn()
            }}
            onKeep={() => setPending(null)}
          />
        ) : null}
        <div className="flex min-h-0 flex-1">
          {runView.active ? null : (
            <WorkflowPalette onAddRole={graph.addRole} onAddStep={graph.addStep} />
          )}
          <div className="min-w-0 flex-1" data-tenure-tour="editor-canvas">
            <ReactFlowProvider>
              <WorkflowCanvas
                key={viewKey}
                nodes={shown.nodes}
                edges={shown.edges}
                onNodesChange={graph.onNodesChange}
                onEdgesChange={graph.onEdgesChange}
                onConnect={graph.onConnect}
                onReconnect={graph.reconnect}
                isValidConnection={graph.isValidConnection}
                onSelect={setSelectedId}
                onAdd={graph.addAt}
                ties={ties}
                readOnly={runView.active}
                dark={dark}
              />
            </ReactFlowProvider>
          </div>
          <div
            className={`w-72 shrink-0 overflow-y-auto border-l scrollbar-sleek ${runView.active ? 'hidden' : ''}`}
          >
            <WorkflowInspector
              node={selected}
              onRenameRole={graph.renameRole}
              onChangeRole={graph.changeRole}
              onChangeStep={graph.changeStep}
              onDelete={(id) => {
                graph.deleteNode(id)
                setSelectedId(null)
              }}
            />
          </div>
          {project && run && runStep && isStepNode(runStep) ? (
            <div className="w-80 shrink-0 border-l">
              <WorkflowRunPanel project={project} runId={run} step={runStep} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
