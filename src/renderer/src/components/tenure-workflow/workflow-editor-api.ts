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
}

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

export async function saveWorkflow(args: {
  project: string | null
  name: string
  scope: WorkflowScope
  workflow: WorkflowDef
  overwrite: boolean
}): Promise<{ id: string; path: string; summary: string }> {
  return tenureCall({
    method: 'POST',
    path: '/api/workflow/save',
    body: { ...args, project: args.project ?? undefined }
  })
}
