import { useEffect, useState } from 'react'
import { Workflow } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { TenureEngineState, TenureLimitWindow } from '../../../../shared/tenure-engine-types'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from './status-bar-context-menu-policy'

function statusLabel(state: TenureEngineState | null): string {
  switch (state?.status) {
    case 'ready':
      return translate('tenure.engine.ready', 'Connected')
    case 'starting':
      return translate('tenure.engine.starting', 'Starting')
    case 'failed':
      return translate('tenure.engine.failed', 'Failed')
    default:
      return translate('tenure.engine.stopped', 'Stopped')
  }
}

function windowText(label: string, w: TenureLimitWindow | null): string {
  return `${label} ${w ? `${Math.round(w.usedPercent)}%` : translate('tenure.engine.unknown', 'unknown')}`
}

function limitLine(
  provider: string,
  windows: { fiveHour: TenureLimitWindow | null; week: TenureLimitWindow | null }
): string {
  const five = windowText(translate('tenure.engine.fiveHour', '5h'), windows.fiveHour)
  const week = windowText(translate('tenure.engine.week', 'week'), windows.week)
  return `${provider}: ${five} · ${week}`
}

/** tenure engine connection and agent slots (DESIGN.md 36.23 M37); click restarts a failed engine. */
export function TenureEngineStatusSegment({
  iconOnly
}: {
  iconOnly: boolean
}): React.JSX.Element | null {
  const [state, setState] = useState<TenureEngineState | null>(null)
  const api = window.api.tenureEngine

  useEffect(() => {
    if (!api) {
      return
    }
    let mounted = true
    const unsubscribe = api.onUpdate((next) => {
      if (mounted) {
        setState(next)
      }
    })
    void api.get().then((initial) => {
      if (mounted) {
        setState((current) => current ?? initial)
      }
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [api])

  if (!api) {
    return null
  }
  const ready = state?.status === 'ready'
  const slots = state?.limits?.slots
  const dot =
    state?.status === 'ready'
      ? 'bg-emerald-500'
      : state?.status === 'failed'
        ? 'bg-red-500'
        : 'bg-yellow-500'
  const limits = state?.limits
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
          onClick={() => {
            if (state?.status === 'failed' || state?.status === 'stopped') {
              void api.restart()
            }
          }}
          aria-label={translate('tenure.engine.label', 'tenure engine')}
        >
          <Workflow className="size-3.5" />
          <span className={`size-1.5 rounded-full ${dot}`} />
          {iconOnly ? null : (
            <span className="text-xs">
              {ready && slots
                ? `${translate('tenure.engine.agents', 'Agents')} ${slots.busy}/${slots.max}`
                : statusLabel(state)}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <div className="flex flex-col gap-0.5 text-xs">
          <span>
            {translate('tenure.engine.label', 'tenure engine')} · {statusLabel(state)}
          </span>
          {state?.detail ? <span className="text-muted-foreground">{state.detail}</span> : null}
          {limits ? (
            <>
              <span>{limitLine('Claude', limits.claude)}</span>
              <span>{limitLine('Codex', limits.codex)}</span>
            </>
          ) : null}
          {state?.status === 'failed' ? (
            <span className="text-muted-foreground">
              {translate('tenure.engine.clickRestart', 'Click to restart')}
            </span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
