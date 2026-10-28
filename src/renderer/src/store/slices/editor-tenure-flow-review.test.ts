import { describe, expect, it, vi } from 'vitest'
import { createEditorStore } from './editor-slice-test-harness'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../shared/git-diff-compare-types'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

// tenure: a flow review opens base commit → HEAD with its own entries and label (DESIGN.md 36.28)
describe('openBranchAllDiffs options', () => {
  const summary: GitBranchCompareSummary = {
    baseRef: 'abc1234def',
    baseOid: 'abc1234def',
    compareRef: 'HEAD',
    headOid: 'head-oid',
    mergeBase: 'abc1234def',
    changedFiles: 1,
    status: 'ready'
  }
  const flowEntry: GitBranchChangeEntry = { path: 'src/todo.py', status: 'added' }

  it('uses the supplied entries and label instead of the source control compare', () => {
    const store = createEditorStore()
    store.setState({
      gitBranchChangesByWorktree: { 'wt-1': [{ path: 'src/other.ts', status: 'modified' }] }
    })

    store.getState().openBranchAllDiffs('wt-1', '/repo', summary, undefined, {
      entriesSnapshot: [flowEntry],
      label: 'tenure: todo CLI'
    })

    expect(store.getState().openFiles[0]).toEqual(
      expect.objectContaining({
        diffSource: 'combined-branch',
        relativePath: 'tenure: todo CLI',
        branchEntriesSnapshot: [flowEntry],
        branchCompare: expect.objectContaining({ baseRef: 'abc1234def' })
      })
    )
    expect(store.getState().gitBranchChangesByWorktree['wt-1']).toEqual([
      { path: 'src/other.ts', status: 'modified' }
    ])
  })

  it('keeps the upstream label and entries without options', () => {
    const store = createEditorStore()
    store.setState({ gitBranchChangesByWorktree: { 'wt-1': [flowEntry] } })

    store.getState().openBranchAllDiffs('wt-1', '/repo', summary)

    expect(store.getState().openFiles[0]).toEqual(
      expect.objectContaining({
        relativePath: 'Branch Changes (abc1234def)',
        branchEntriesSnapshot: [flowEntry]
      })
    )
  })
})
