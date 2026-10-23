import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { DiffComment } from '../../../shared/diff-comment-types'

/** Hands diff notes to the workspace's last finished tenure flow as a fix round, then marks them Sent. */
export async function sendDiffNotesToTenureFlow(
  worktreeId: string,
  notes: readonly DiffComment[]
): Promise<{ ok: boolean; message: string }> {
  const api = window.api.tenureEngine
  const state = useAppStore.getState()
  const path = state.getKnownWorktreeById(worktreeId)?.path
  if (!api || !path) {
    return {
      ok: false,
      message: translate('tenure.flow.notes.noEngine', 'tenure engine is not available.')
    }
  }
  const res = await api.request({
    method: 'POST',
    path: '/api/flow/notes',
    body: {
      project: path,
      notes: notes.map((note) => ({
        file: note.filePath,
        line: note.lineNumber,
        text:
          note.startLine && note.startLine !== note.lineNumber
            ? `(L${note.startLine}-${note.lineNumber}) ${note.body}`
            : note.body
      }))
    }
  })
  if (!res.ok) {
    return { ok: false, message: res.error ?? `HTTP ${res.status}` }
  }
  await state.markDiffCommentsSent(
    worktreeId,
    notes.map((note) => note.id)
  )
  return {
    ok: true,
    message: translate('tenure.flow.notes.sent', 'Notes sent. The flow starts a fix round.')
  }
}
