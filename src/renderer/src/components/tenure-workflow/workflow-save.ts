import { translate } from '@/i18n/i18n'
import { emptySlots, type GraphProblem } from './workflow-convert'
import { kindLabel, orderProblemText, slotLabel } from './workflow-labels'
import type { WorkflowDef } from './workflow-model'
import type { EditorStatus } from './WorkflowToolbar'
import { checkWorkflow, saveWorkflow, type WorkflowScope } from './workflow-editor-api'

// tenure: the editor's Check and Save (DESIGN.md 36.29 M44). The editor's own checks come first so
// the message can point at a dot; the engine has the final say.

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function checkCurrent(
  project: string | null,
  current: { def: WorkflowDef; problem: GraphProblem }
): Promise<{ ok: boolean; status: EditorStatus }> {
  const orderText = orderProblemText(current.problem)
  if (orderText) {
    return { ok: false, status: { tone: 'error', text: orderText } }
  }
  const empty = emptySlots(current.def)[0]
  if (empty) {
    return {
      ok: false,
      status: {
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
      }
    }
  }
  try {
    const res = await checkWorkflow(project, current.def)
    return res.ok
      ? {
          ok: true,
          status: {
            tone: 'ok',
            text: translate('tenure.workflow.checkOk', 'Looks good: {{value0}}', {
              value0: res.summary ?? ''
            })
          }
        }
      : { ok: false, status: { tone: 'error', text: res.error ?? '' } }
  } catch (e) {
    return { ok: false, status: { tone: 'error', text: errorText(e) } }
  }
}

export async function saveCurrent(req: {
  project: string | null
  title: string
  // The file to write over; without it the engine makes a new file name from the title.
  fileId: string | null
  scope: WorkflowScope
  def: WorkflowDef
}): Promise<{ id: string | null; status: EditorStatus }> {
  try {
    const res = await saveWorkflow({
      project: req.project,
      title: req.title,
      id: req.fileId ?? undefined,
      scope: req.scope,
      workflow: req.def,
      overwrite: !!req.fileId
    })
    return {
      id: res.id,
      status: {
        tone: 'ok',
        text: translate('tenure.workflow.saved', 'Saved: {{value0}}', { value0: res.path })
      }
    }
  } catch (e) {
    return { id: null, status: { tone: 'error', text: errorText(e) } }
  }
}
