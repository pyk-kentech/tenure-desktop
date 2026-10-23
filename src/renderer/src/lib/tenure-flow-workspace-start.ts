import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'

/** After a workspace is created with "start a tenure flow": run the flow in that folder and reveal the Flows panel. */
export async function startTenureFlowInNewWorkspace(
  path: string,
  task: string | undefined,
  reveal: boolean
): Promise<void> {
  const api = window.api.tenureEngine
  const text = task?.trim()
  if (!api || !text) {
    return
  }
  const res = await api.request({
    method: 'POST',
    path: '/api/actions/run',
    // Why worktree off: the new workspace already is an isolated worktree.
    body: { project: path, task: text, force: true, options: { worktree: 'off' } }
  })
  if (!res.ok) {
    toast.error(
      translate('tenure.flow.composer.failed', 'Could not start the flow: {{value0}}', {
        value0: res.error ?? String(res.status)
      })
    )
    return
  }
  if (reveal) {
    const state = useAppStore.getState()
    state.setRightSidebarTab('tenure')
    state.setRightSidebarOpen(true)
  }
}
