import { useSyncExternalStore } from 'react'

// Per-folder tenure flow status for sidebar cards, from one shared poll of the engine's /api/works.
export type TenureFlowCardState = 'working' | 'blocked' | 'failed' | 'done-unseen'

const POLL_MS = 5000
const RANK: Record<TenureFlowCardState, number> = {
  blocked: 4,
  failed: 3,
  'done-unseen': 2,
  working: 1
}

let byPath = new Map<string, TenureFlowCardState>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

export function tenurePathKey(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  return navigator.userAgent.includes('Windows') ? trimmed.toLowerCase() : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function itemState(item: Record<string, unknown>): TenureFlowCardState | null {
  if (item.live === true) {
    return 'working'
  }
  const activity = isRecord(item.activity) ? item.activity.state : null
  return activity === 'blocked' || activity === 'failed' || activity === 'done-unseen'
    ? activity
    : null
}

async function poll(): Promise<void> {
  const api = window.api.tenureEngine
  if (!api || document.hidden) {
    return
  }
  const res = await api.request({ method: 'GET', path: '/api/works' })
  if (!res.ok || !isRecord(res.data) || !Array.isArray(res.data.groups)) {
    return
  }
  const next = new Map<string, TenureFlowCardState>()
  for (const group of res.data.groups) {
    if (!isRecord(group) || typeof group.path !== 'string' || !Array.isArray(group.items)) {
      continue
    }
    let best: TenureFlowCardState | null = null
    for (const item of group.items) {
      const state = isRecord(item) ? itemState(item) : null
      if (state && (!best || RANK[state] > RANK[best])) {
        best = state
      }
    }
    if (best) {
      next.set(tenurePathKey(group.path), best)
    }
  }
  byPath = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer) {
    void poll()
    timer = setInterval(() => void poll(), POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useTenureFlowState(path: string | null | undefined): TenureFlowCardState | null {
  return useSyncExternalStore(subscribe, () =>
    path ? (byPath.get(tenurePathKey(path)) ?? null) : null
  )
}
