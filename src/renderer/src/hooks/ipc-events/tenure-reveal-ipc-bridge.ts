import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { tenurePathKey } from '@/lib/tenure-flow-status-store'

/** The engine island asked to open a work item: select the workspace for its folder and show the Flows panel. */
export function revealTenureTarget(hash: string): void {
  const state = useAppStore.getState()
  const match = /^#(?:\/m\/[^/]+)?\/p\/([^/?]+)/.exec(hash)
  if (match) {
    const key = tenurePathKey(decodeURIComponent(match[1]))
    const worktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((wt) => tenurePathKey(wt.path) === key)
    if (worktree) {
      activateAndRevealWorktree(worktree.id)
    }
  }
  state.setRightSidebarTab('tenure')
  state.setRightSidebarOpen(true)
}

export function registerTenureRevealIpcBridge(unsubs: (() => void)[]): void {
  const api = window.api.tenureEngine
  if (api) {
    unsubs.push(api.onReveal((target) => revealTenureTarget(target.hash)))
  }
}
