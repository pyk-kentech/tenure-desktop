import type { Edge } from '@xyflow/react'
import type { EditorLayout, WorkflowNode } from './workflow-model'
import { wireKey, type Point, type Tie, type Via } from './workflow-ties'

// tenure: bend points and group boxes (DESIGN.md 36.39), and how ties and bends follow moved nodes.
// Pure geometry and the saved-layout format; the canvas wires them up.

/** A point one line is routed through (flow coordinates). */
export type Bend = { id: string; edge: string; x: number; y: number }
/** A titled box drawn behind nodes; dragging its title moves the nodes inside. */
export type Group = { id: string; title: string; x: number; y: number; w: number; h: number }

export const GROUP_HEAD = 28
const GROUP_PAD = 24

let seq = 0
export function newDecorId(kind: 'bend' | 'group'): string {
  seq += 1
  return `${kind}-${Date.now().toString(36)}-${seq}`
}

// ---------------------------------------------------------------- saved layout

export function bendsFromLayout(
  layout: EditorLayout | undefined,
  edges: Edge[],
  keyOf: Map<string, string>
): Bend[] {
  const edgeOf = new Map<string, string>()
  for (const e of edges) {
    const k = wireKey(e, keyOf)
    if (k) {
      edgeOf.set(k, e.id)
    }
  }
  return (layout?.bends ?? []).flatMap((b) => {
    const edge = edgeOf.get(b.wire)
    return edge ? [{ id: newDecorId('bend'), edge, x: b.x, y: b.y }] : []
  })
}

export function groupsFromLayout(layout: EditorLayout | undefined): Group[] {
  return (layout?.groups ?? []).map((g) => ({ id: newDecorId('group'), ...g }))
}

export function savedBends(bends: Bend[], edges: Edge[], keyOf: Map<string, string>) {
  const byId = new Map(edges.map((e) => [e.id, e]))
  return bends.flatMap((b) => {
    const e = byId.get(b.edge)
    const wire = e ? wireKey(e, keyOf) : null
    return wire ? [{ wire, x: Math.round(b.x), y: Math.round(b.y) }] : []
  })
}

export function savedGroups(groups: Group[]) {
  return groups.map((g) => ({
    title: g.title,
    x: Math.round(g.x),
    y: Math.round(g.y),
    w: Math.round(g.w),
    h: Math.round(g.h)
  }))
}

/** Bends whose line still exists. */
export function liveBends(bends: Bend[], edges: Edge[]): Bend[] {
  const ids = new Set(edges.map((e) => e.id))
  return bends.filter((b) => ids.has(b.edge))
}

// ---------------------------------------------------------------- routing

/** Every line's points to pass: tie strands keep their direction, bends (dx = dy = 0) get one
 * from their neighbours when the path is drawn. */
export function lineRoutes(tieVias: Map<string, Via[]>, bends: Bend[]): Map<string, Via[]> {
  const out = new Map(tieVias)
  for (const b of bends) {
    out.set(b.edge, [...(out.get(b.edge) ?? []), { x: b.x, y: b.y, dx: 0, dy: 0 }])
  }
  return out
}

// ---------------------------------------------------------------- following moved nodes

/** How far a line's middle moved: half of each end's move. */
function lineShift(e: Edge | undefined, moved: Map<string, Point>): Point {
  const a = e ? moved.get(e.source) : undefined
  const b = e ? moved.get(e.target) : undefined
  return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 }
}

/** Ties move with the lines they hold: by the average shift of those lines. */
export function followTies(ties: Tie[], edges: Edge[], moved: Map<string, Point>): Tie[] {
  const byId = new Map(edges.map((e) => [e.id, e]))
  return ties.map((t) => {
    const shifts = t.edges.map((id) => lineShift(byId.get(id), moved))
    const dx = shifts.reduce((s, p) => s + p.x, 0) / Math.max(1, shifts.length)
    const dy = shifts.reduce((s, p) => s + p.y, 0) / Math.max(1, shifts.length)
    return dx || dy ? { ...t, x: t.x + dx, y: t.y + dy } : t
  })
}

export function followBends(bends: Bend[], edges: Edge[], moved: Map<string, Point>): Bend[] {
  const byId = new Map(edges.map((e) => [e.id, e]))
  return bends.map((b) => {
    const d = lineShift(byId.get(b.edge), moved)
    return d.x || d.y ? { ...b, x: b.x + d.x, y: b.y + d.y } : b
  })
}

// ---------------------------------------------------------------- groups

function size(n: WorkflowNode): { w: number; h: number } {
  return { w: n.measured?.width ?? n.width ?? 200, h: n.measured?.height ?? n.height ?? 80 }
}

/** Nodes whose middle is inside the box. */
export function groupMembers(g: Group, nodes: WorkflowNode[]): string[] {
  return nodes
    .filter((n) => {
      const { w, h } = size(n)
      const cx = n.position.x + w / 2
      const cy = n.position.y + h / 2
      return cx >= g.x && cx <= g.x + g.w && cy >= g.y && cy <= g.y + g.h
    })
    .map((n) => n.id)
}

/** A box around the given nodes (with room for the title), or a plain box at `at`. */
export function boxAround(nodes: WorkflowNode[], at: Point, title: string): Group {
  if (nodes.length === 0) {
    return { id: newDecorId('group'), title, x: at.x, y: at.y, w: 360, h: 220 }
  }
  const xs = nodes.flatMap((n) => [n.position.x, n.position.x + size(n).w])
  const ys = nodes.flatMap((n) => [n.position.y, n.position.y + size(n).h])
  const x = Math.min(...xs) - GROUP_PAD
  const y = Math.min(...ys) - GROUP_PAD - GROUP_HEAD
  return {
    id: newDecorId('group'),
    title,
    x,
    y,
    w: Math.max(...xs) + GROUP_PAD - x,
    h: Math.max(...ys) + GROUP_PAD - y
  }
}
