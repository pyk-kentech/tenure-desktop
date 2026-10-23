import type { TenureEngineLimits, TenureLimitWindow } from '../../shared/tenure-engine-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toWindow(value: unknown): TenureLimitWindow | null {
  if (!isRecord(value) || typeof value.used_percent !== 'number') {
    return null
  }
  const reset = value.resets_at
  const resetsAt =
    typeof reset === 'number'
      ? new Date(reset * 1000).toISOString()
      : typeof reset === 'string'
        ? reset
        : null
  return { usedPercent: value.used_percent, resetsAt }
}

/** Engine `/api/limits` → shell shape. Codex keeps primary/secondary; Claude keeps five_hour/seven_day. */
export function parseTenureLimits(raw: unknown): TenureEngineLimits {
  const root = isRecord(raw) ? raw : {}
  const codex = isRecord(root.codex) ? root.codex : {}
  const claudeRoot = isRecord(root.claude) ? root.claude : {}
  const claude = isRecord(claudeRoot.limits) ? claudeRoot.limits : {}
  const slots = isRecord(root.slots) ? root.slots : null
  return {
    slots:
      slots && typeof slots.busy === 'number' && typeof slots.max === 'number'
        ? { busy: slots.busy, max: slots.max }
        : null,
    claude: { fiveHour: toWindow(claude.five_hour), week: toWindow(claude.seven_day) },
    codex: { fiveHour: toWindow(codex.primary), week: toWindow(codex.secondary) }
  }
}
