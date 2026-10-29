import { tenureCall } from '../right-sidebar/tenure-flow/tenure-flow-api'
import type { WorkflowDef } from './workflow-model'

// tenure engine APIs for the workflow editor (src/tenure/ui/workflow_api.py, DESIGN.md 36.29).

export type WorkflowListItem = {
  id: string
  name: string
  description?: string
  source: string
  source_label?: string
  summary?: string
  error?: string
  // Roles in use and steps, for the start form's preview (DESIGN.md 36.37 M52).
  roles?: { name: string; agent: string; model?: string }[]
  steps?: (Record<string, unknown> & { kind: string })[]
}

export type ModelChoice = { id: string; label?: string; note?: string; efforts?: string[] }
export type ModelChoices = Record<'claude' | 'codex', { models: ModelChoice[]; efforts: string[] }>

export type WorkflowScope = 'project' | 'user'

export async function listWorkflows(project: string | null): Promise<WorkflowListItem[]> {
  const res = await tenureCall<{ workflows: WorkflowListItem[] }>({
    method: 'GET',
    path: '/api/workflows',
    query: project ? { project } : {}
  })
  return res.workflows
}

export async function getWorkflow(
  project: string | null,
  name: string
): Promise<{ id: string; source: string; definition: WorkflowDef }> {
  return tenureCall({
    method: 'GET',
    path: '/api/workflow',
    query: project ? { project, name } : { name }
  })
}

export async function checkWorkflow(
  project: string | null,
  workflow: WorkflowDef
): Promise<{ ok: boolean; error?: string; summary?: string }> {
  return tenureCall({
    method: 'POST',
    path: '/api/workflow/check',
    body: { project: project ?? undefined, workflow }
  })
}

/** Save under a display name (any text); the engine picks the file name unless `id` is given. */
export async function saveWorkflow(args: {
  project: string | null
  title: string
  id?: string
  scope: WorkflowScope
  workflow: WorkflowDef
  overwrite: boolean
}): Promise<{ id: string; name: string; path: string; summary: string }> {
  return tenureCall({
    method: 'POST',
    path: '/api/workflow/save',
    body: { ...args, project: args.project ?? undefined }
  })
}

/** Model and effort choices for role settings (src/tenure/ui/server.py model_suggestions). */
export async function listModels(): Promise<ModelChoices> {
  return tenureCall({ method: 'GET', path: '/api/models' })
}
