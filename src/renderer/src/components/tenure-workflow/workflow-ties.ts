import type { Edge } from '@xyflow/react'
import { isRoleNode, isStepNode, type EditorLayout, type WorkflowNode } from './workflow-model'

// tenure: cable ties that bundle lines (DESIGN.md 36.34). Idea from comfyui-zip-ties (MIT), written
// anew for React Flow. Pure geometry and the saved-layout format; the canvas wires them up.

export type Point = { x: number; y: number }
/** A tie on the canvas: flow coordinates, angle in degrees (0: lines pass left to right). */
export type Tie = { id: string; x: number; y: number; angle: number; edges: string[] }
/** Where a tied line passes: the strand's point and the direction it runs there. */
export type Via = Point & { dx: number; dy: number }

export const STRAND_GAP = 6
const ANGLE_STEP = 15

let tieSeq = 0
export function newTieId(): string {
  tieSeq += 1
  return `tie-${Date.now().toString(36)}-${tieSeq}`
}

export function snapAngle(deg: number, step = ANGLE_STEP): number {
  return (((Math.round(deg / step) * step) % 360) + 360) % 360
}

function dir(angle: number): Point {
  const r = (angle * Math.PI) / 180
  return { x: Math.cos(r), y: Math.sin(r) }
}

/** Length of the tie band across its strands. */
export function tieLength(tie: Tie): number {
  return Math.max(1, tie.edges.length) * STRAND_GAP + 8
}

// ---------------------------------------------------------------- saved layout keys

/** Stable names for nodes in the saved layout: role:<name>, step:<1-based order in steps>. */
export function nodeKeys(nodes: WorkflowNode[], stepOrder: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const n of nodes) {
    if (isRoleNode(n)) {
      out.set(n.id, `role:${n.data.name}`)
    }
  }
  stepOrder.forEach((id, i) => out.set(id, `step:${i + 1}`))
  return out
}

export function wireKey(e: Edge, keyOf: Map<string, string>): string | null {
  const from = keyOf.get(e.source)
  const to = keyOf.get(e.target)
  return from && to && e.sourceHandle && e.targetHandle
    ? `${from}/${e.sourceHandle}>${to}/${e.targetHandle}`
    : null
}

/** Saved ties → canvas ties (lines that no longer exist are left out). */
export function tiesFromLayout(
  layout: EditorLayout | undefined,
  edges: Edge[],
  keyOf: Map<string, string>
): Tie[] {
  const edgeOf = new Map<string, string>()
  for (const e of edges) {
    const k = wireKey(e, keyOf)
    if (k) {
      edgeOf.set(k, e.id)
    }
  }
  return (layout?.ties ?? [])
    .map((t) => ({
      id: newTieId(),
      x: t.x,
      y: t.y,
      angle: t.angle,
      edges: t.wires.map((w) => edgeOf.get(w)).filter((id): id is string => !!id)
    }))
    .filter((t) => t.edges.length > 0)
}

/** Node positions and ties in the saved form (integers, stable keys). */
export function layoutOf(
  nodes: WorkflowNode[],
  edges: Edge[],
  ties: Tie[],
  keyOf: Map<string, string>
): EditorLayout {
  const positions: Record<string, [number, number]> = {}
  for (const n of nodes) {
    const k = keyOf.get(n.id)
    if (k && (isRoleNode(n) || isStepNode(n))) {
      positions[k] = [Math.round(n.position.x), Math.round(n.position.y)]
    }
  }
  const byId = new Map(edges.map((e) => [e.id, e]))
  const saved = ties
    .map((t) => ({
      x: Math.round(t.x),
      y: Math.round(t.y),
      angle: Math.round(t.angle),
      wires: t.edges
        .map((id) => byId.get(id))
        .map((e) => (e ? wireKey(e, keyOf) : null))
        .filter((w): w is string => !!w)
    }))
    .filter((t) => t.wires.length > 0)
  return saved.length ? { nodes: positions, ties: saved } : { nodes: positions }
}

/** Ties whose lines still exist, with gone lines dropped. */
export function liveTies(ties: Tie[], edges: Edge[]): Tie[] {
  const ids = new Set(edges.map((e) => e.id))
  return ties
    .map((t) => ({ ...t, edges: t.edges.filter((id) => ids.has(id)) }))
    .filter((t) => t.edges.length > 0)
}

// ---------------------------------------------------------------- routing

/** For every tied line, the strands it passes (in tie order; the edge sorts them along itself). */
export function tieRoutes(ties: Tie[]): Map<string, Via[]> {
  const out = new Map<string, Via[]>()
  for (const t of ties) {
    const d = dir(t.angle)
    const n = t.edges.length
    t.edges.forEach((id, i) => {
      const off = (i - (n - 1) / 2) * STRAND_GAP
      const via = { x: t.x - d.y * off, y: t.y + d.x * off, dx: d.x, dy: d.y }
      out.set(id, [...(out.get(id) ?? []), via])
    })
  }
  return out
}

/**
 * A line from `start` to `end` through each via, as joined cubic curves. Ends leave and enter
 * connectors horizontally; at a via the line runs along the tie's direction (flipped when the
 * line heads the other way, e.g. a loop going back).
 */
export function viaPath(start: Point, end: Point, vias: Via[]): string {
  const ax = end.x - start.x
  const ay = end.y - start.y
  const along = (p: Point) => (p.x - start.x) * ax + (p.y - start.y) * ay
  const pts: Via[] = [
    { ...start, dx: 1, dy: 0 },
    ...[...vias].sort((a, b) => along(a) - along(b)),
    { ...end, dx: 1, dy: 0 }
  ]
  const parts = [`M ${start.x} ${start.y}`]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const k = Math.min(150, Math.max(20, dist * 0.4))
    const sa = i === 1 || a.dx * (b.x - a.x) + a.dy * (b.y - a.y) >= 0 ? 1 : -1
    const sb = i === pts.length - 1 || b.dx * (b.x - a.x) + b.dy * (b.y - a.y) >= 0 ? 1 : -1
    parts.push(
      `C ${a.x + a.dx * k * sa} ${a.y + a.dy * k * sa}, ${b.x - b.dx * k * sb} ${b.y - b.dy * k * sb}, ${b.x} ${b.y}`
    )
  }
  return parts.join(' ')
}

// ---------------------------------------------------------------- cutting across lines

function crossAt(p: Point, q: Point, a: Point, b: Point): number | null {
  const r = { x: q.x - p.x, y: q.y - p.y }
  const s = { x: b.x - a.x, y: b.y - a.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-9) {
    return null
  }
  const t = ((a.x - p.x) * s.y - (a.y - p.y) * s.x) / den
  const u = ((a.x - p.x) * r.y - (a.y - p.y) * r.x) / den
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null
}

/** Lines the cut p→q crosses, ordered along the cut (t from 0 at p to 1 at q). */
export function crossedLines(
  p: Point,
  q: Point,
  lines: Map<string, Point[]>
): { id: string; t: number }[] {
  const out: { id: string; t: number }[] = []
  for (const [id, pts] of lines) {
    for (let i = 1; i < pts.length; i++) {
      const t = crossAt(p, q, pts[i - 1], pts[i])
      if (t !== null) {
        out.push({ id, t })
        break
      }
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Ties the cut p→q passes over. */
export function cutTies(p: Point, q: Point, ties: Tie[]): Tie[] {
  return ties.filter((tie) => {
    const d = dir(tie.angle)
    const half = tieLength(tie) / 2 + 4
    const a = { x: tie.x + d.y * half, y: tie.y - d.x * half }
    const b = { x: tie.x - d.y * half, y: tie.y + d.x * half }
    return crossAt(p, q, a, b) !== null
  })
}

/**
 * A new tie for the lines a cut crossed: at the middle of the crossings, lines passing across the
 * cut (snapped to 15°, heading right), strands in the order the cut met them.
 */
export function tieFromCut(p: Point, q: Point, crossed: { id: string; t: number }[]): Tie | null {
  if (crossed.length === 0) {
    return null
  }
  const t = (crossed[0].t + (crossed.at(-1)?.t ?? crossed[0].t)) / 2
  let nx = q.y - p.y
  let ny = -(q.x - p.x)
  if (nx < 0 || (nx === 0 && ny < 0)) {
    nx = -nx
    ny = -ny
  }
  const angle = snapAngle((Math.atan2(ny, nx) * 180) / Math.PI)
  const d = dir(angle)
  // Why: strands sit across the tie in the order (-sin, cos); keep the cut's order on that axis.
  const forward = (q.x - p.x) * -d.y + (q.y - p.y) * d.x >= 0
  const ids = crossed.map((c) => c.id)
  return {
    id: newTieId(),
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    angle,
    edges: [...new Set(forward ? ids : ids.toReversed())]
  }
}
