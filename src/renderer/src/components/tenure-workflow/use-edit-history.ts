import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Edge } from '@xyflow/react'
import type { WorkflowNode } from './workflow-model'
import type { Tie } from './workflow-ties'

// tenure: undo / redo and "unsaved changes" for the workflow editor (DESIGN.md 36.36 M51).
// Every settled change to nodes, lines, ties, settings or positions is one step; a drag or a burst
// of edits settles into one step after a short pause.

export type EditSnapshot = { nodes: WorkflowNode[]; edges: Edge[]; ties: Tie[] }

const SETTLE_MS = 350
const MAX_STEPS = 100

/** What counts as a change: not selection, measuring or folding a node. */
export function editSignature(nodes: WorkflowNode[], edges: Edge[], ties: Tie[]): string {
  return JSON.stringify([
    nodes.map((n) => {
      const {
        collapsed: _c,
        sockets: _s,
        progress: _p,
        ...data
      } = n.data as Record<string, unknown>
      return [n.id, n.type, Math.round(n.position.x), Math.round(n.position.y), data]
    }),
    edges.map((e) => [e.id, e.source, e.sourceHandle, e.target, e.targetHandle]),
    ties.map((t) => [t.id, Math.round(t.x), Math.round(t.y), t.angle, t.edges])
  ])
}

type Stack = { snaps: EditSnapshot[]; sigs: string[]; at: number; saved: string | null }

export function useEditHistory(
  current: EditSnapshot,
  enabled: boolean,
  restore: (snap: EditSnapshot) => void
) {
  const sig = useMemo(
    () => editSignature(current.nodes, current.edges, current.ties),
    [current.nodes, current.edges, current.ties]
  )
  const stack = useRef<Stack>({ snaps: [], sigs: [], at: -1, saved: null })
  const latest = useRef({ current, sig })
  useLayoutEffect(() => {
    latest.current = { current, sig }
  })
  const [, setVersion] = useState(0)

  const record = useCallback(() => {
    const h = stack.current
    const { current: snap, sig: now } = latest.current
    if (h.sigs[h.at] === now) {
      return
    }
    h.snaps = [...h.snaps.slice(0, h.at + 1), snap].slice(-MAX_STEPS)
    h.sigs = [...h.sigs.slice(0, h.at + 1), now].slice(-MAX_STEPS)
    h.at = h.snaps.length - 1
    // Why: the first settled picture after loading is what "unchanged" means.
    h.saved ??= now
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }
    const timer = window.setTimeout(record, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [sig, enabled, record])

  const go = useCallback(
    (delta: number) => {
      record()
      const h = stack.current
      const at = h.at + delta
      if (at < 0 || at >= h.snaps.length) {
        return
      }
      h.at = at
      restore(h.snaps[at])
      setVersion((v) => v + 1)
    },
    [record, restore]
  )

  const reset = useCallback(() => {
    stack.current = { snaps: [], sigs: [], at: -1, saved: null }
    setVersion((v) => v + 1)
  }, [])

  const markSaved = useCallback(() => {
    stack.current.saved = latest.current.sig
    setVersion((v) => v + 1)
  }, [])

  const undo = useCallback(() => go(-1), [go])
  const redo = useCallback(() => go(1), [go])
  const h = stack.current
  return {
    undo,
    redo,
    canUndo: h.at > 0 || (h.at >= 0 && h.sigs[h.at] !== sig),
    canRedo: h.at < h.snaps.length - 1,
    dirty: h.saved !== null && h.saved !== sig,
    reset,
    markSaved
  }
}

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y while the editor is open, except while typing in a field. */
export function useUndoKeys(active: boolean, undo: () => void, redo: () => void): void {
  useEffect(() => {
    if (!active) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (
        !(e.ctrlKey || e.metaKey) ||
        (t instanceof HTMLElement &&
          (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))
      ) {
        return
      }
      if (e.code === 'KeyZ' || e.code === 'KeyY') {
        e.preventDefault()
        if (e.code === 'KeyY' || e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, undo, redo])
}
