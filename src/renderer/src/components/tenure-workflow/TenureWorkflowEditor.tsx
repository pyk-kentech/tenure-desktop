import React, { useCallback, useEffect, useState } from 'react'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { translate } from '@/i18n/i18n'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { WORKFLOW_NODE_TYPES } from './WorkflowNodes'
import { WorkflowInspector } from './WorkflowInspector'
import { WorkflowPalette } from './WorkflowPalette'
import { WorkflowToolbar, type EditorStatus } from './WorkflowToolbar'
import { useWorkflowGraph } from './use-workflow-graph'
import { emptySlots, fromGraph } from './workflow-model'
import { kindLabel, orderProblemText, slotLabel } from './workflow-labels'
import {
  checkWorkflow,
  getWorkflow,
  listWorkflows,
  saveWorkflow,
  type WorkflowListItem,
  type WorkflowScope
} from './workflow-editor-api'

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
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: string | null
  initial?: string
  onSaved?: (id: string) => void
}): React.JSX.Element {
  const graph = useWorkflowGraph()
  const [templates, setTemplates] = useState<WorkflowListItem[]>([])
  const [template, setTemplate] = useState(initial ?? 'quick')
  const [saveName, setSaveName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<WorkflowScope>(project ? 'project' : 'user')
  const [overwrite, setOverwrite] = useState(false)
  const [status, setStatus] = useState<EditorStatus | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewKey, setViewKey] = useState(0)
  const { load } = graph

  const loadTemplate = useCallback(
    async (id: string) => {
      setStatus(null)
      setSelectedId(null)
      try {
        const res = await getWorkflow(project, id)
        load(res.definition)
        setTemplate(id)
        setSaveName(res.source === 'project' || res.source === 'user' ? id : `my-${id}`)
        setDescription(res.definition.description)
        setViewKey((k) => k + 1)
      } catch (e) {
        setStatus({ tone: 'error', text: errorText(e) })
      }
    },
    [project, load]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    listWorkflows(project)
      .then((items) => setTemplates(items.filter((w) => w.source !== 'error')))
      .catch((e: unknown) => setStatus({ tone: 'error', text: errorText(e) }))
    void loadTemplate(initial ?? 'quick')
  }, [open, project, initial, loadTemplate])

  const current = () =>
    fromGraph(graph.nodes, graph.edges, { name: saveName || template, description })

  const runCheck = async (): Promise<boolean> => {
    const { def, problem } = current()
    const orderText = orderProblemText(problem)
    if (orderText) {
      setStatus({ tone: 'error', text: orderText })
      return false
    }
    const empty = emptySlots(def)[0]
    if (empty) {
      setStatus({
        tone: 'error',
        text: translate(
          'tenure.workflow.problem.slot',
          'Step {{value0}} ({{value1}}): connect a role to "{{value2}}".',
          {
            value0: String(empty.index),
            value1: kindLabel(empty.kind),
            value2: slotLabel(empty.slot)
          }
        )
      })
      return false
    }
    try {
      const res = await checkWorkflow(project, def)
      setStatus(
        res.ok
          ? {
              tone: 'ok',
              text: translate('tenure.workflow.checkOk', 'Looks good: {{value0}}', {
                value0: res.summary ?? ''
              })
            }
          : { tone: 'error', text: res.error ?? '' }
      )
      return res.ok
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(e) })
      return false
    }
  }

  const runSave = async () => {
    if (!(await runCheck())) {
      return
    }
    try {
      const res = await saveWorkflow({
        project,
        name: saveName,
        scope,
        workflow: current().def,
        overwrite
      })
      setStatus({
        tone: 'ok',
        text: translate('tenure.workflow.saved', 'Saved: {{value0}}', { value0: res.path })
      })
      onSaved?.(res.id)
    } catch (e) {
      setStatus({ tone: 'error', text: errorText(e) })
    }
  }

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null
  const dark = document.documentElement.classList.contains('dark')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogTitle className="sr-only">
          {translate('tenure.workflow.title', 'Workflow editor')}
        </DialogTitle>
        <WorkflowToolbar
          templates={templates}
          template={template}
          onTemplate={(id) => void loadTemplate(id)}
          saveName={saveName}
          onSaveName={setSaveName}
          description={description}
          onDescription={setDescription}
          scope={scope}
          onScope={setScope}
          canProjectScope={!!project}
          overwrite={overwrite}
          onOverwrite={setOverwrite}
          onTidy={() => {
            graph.tidy()
            setViewKey((k) => k + 1)
          }}
          onCheck={() => void runCheck()}
          onSave={() => void runSave()}
          status={status}
        />
        <div className="flex min-h-0 flex-1">
          <WorkflowPalette onAddRole={graph.addRole} onAddStep={graph.addStep} />
          <div className="min-w-0 flex-1">
            <ReactFlow
              key={viewKey}
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={WORKFLOW_NODE_TYPES}
              onNodesChange={graph.onNodesChange}
              onEdgesChange={graph.onEdgesChange}
              onConnect={graph.onConnect}
              isValidConnection={graph.isValidConnection}
              onSelectionChange={({ nodes }) => setSelectedId(nodes[0]?.id ?? null)}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              colorMode={dark ? 'dark' : 'light'}
              deleteKeyCode={['Delete', 'Backspace']}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.2}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="w-72 shrink-0 overflow-y-auto border-l scrollbar-sleek">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
