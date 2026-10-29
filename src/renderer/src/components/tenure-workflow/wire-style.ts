import type { WireStyle } from './WorkflowEdges'

// tenure: the line shape is a per-PC preference (DESIGN.md 36.33); storage may be unavailable.
const KEY = 'tenure.workflow.wire'

export function loadWireStyle(): WireStyle {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'straight' || v === 'step' ? v : 'bezier'
  } catch {
    return 'bezier'
  }
}

export function saveWireStyle(v: WireStyle): void {
  try {
    window.localStorage.setItem(KEY, v)
  } catch {
    // Why: without storage the choice simply lasts for this session.
  }
}
