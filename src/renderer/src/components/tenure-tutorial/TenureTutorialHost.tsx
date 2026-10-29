import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { TUTORIAL_EVENT, tutorialSteps } from './tutorial-steps'

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6
const TRACK_MS = 250

function useTargetRect(target: (() => Element | null) | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)
  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }
    // Why: panels open, dialogs mount and layouts shift while the user follows along.
    const measure = () => {
      const r = target()?.getBoundingClientRect()
      setRect((prev) => {
        if (!r || r.width === 0) {
          return null
        }
        const next = { top: r.top, left: r.left, width: r.width, height: r.height }
        return prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
          ? prev
          : next
      })
    }
    measure()
    const timer = window.setInterval(measure, TRACK_MS)
    return () => window.clearInterval(timer)
  }, [target])
  return rect
}

/**
 * tenure: the in-app walkthrough (DESIGN.md 36.31 M46). Lives beside the engine status segment so
 * it survives sidebar tab changes; draws a progress card and a highlight ring above any dialog.
 */
export function TenureTutorialHost(): React.JSX.Element | null {
  const [index, setIndex] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const active = index !== null
  const steps = useMemo(() => (active ? tutorialSteps() : []), [active])
  const step = index === null ? undefined : steps[index]
  const rect = useTargetRect(step?.target)

  useEffect(() => {
    const open = () => {
      setIndex(0)
      setNote(null)
    }
    window.addEventListener(TUTORIAL_EVENT, open)
    return () => window.removeEventListener(TUTORIAL_EVENT, open)
  }, [])

  const go = useCallback((next: number | null) => {
    setIndex(next)
    setNote(null)
  }, [])

  // A step the user must do: move on when its condition turns true while the step is shown.
  // Why: coming Back to it with the condition already true must not jump straight forward again.
  useEffect(() => {
    const waitFor = step?.waitFor
    if (index === null || !waitFor) {
      return
    }
    let was = waitFor()
    const timer = window.setInterval(() => {
      const now = waitFor()
      if (now && !was) {
        go(index + 1)
      }
      was = now
    }, TRACK_MS)
    return () => window.clearInterval(timer)
  }, [index, step, go])

  if (index === null || !step) {
    return null
  }
  const last = index === steps.length - 1
  const waiting = !!step.waitFor && !step.waitFor()
  return createPortal(
    <div data-tenure-tutorial="" style={{ pointerEvents: 'none' }}>
      {rect ? (
        <div
          className="fixed z-[1000] rounded-md ring-2 ring-sky-500 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.28)'
          }}
        />
      ) : null}
      <div
        role="dialog"
        aria-label={step.title}
        className="fixed bottom-10 right-6 z-[1001] w-[360px] rounded-lg border bg-popover p-4 text-sm text-popover-foreground shadow-xl"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="mb-1 flex items-start gap-2">
          <div className="flex-1 font-medium">{step.title}</div>
          <span className="text-xs text-muted-foreground">
            {translate('tenure.tutorial.progress', '{{value0}} / {{value1}}', {
              value0: String(index + 1),
              value1: String(steps.length)
            })}
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
            aria-label={translate('tenure.tutorial.close', 'Close')}
            onClick={() => go(null)}
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
        {note ? <p className="mt-2 text-xs text-destructive">{note}</p> : null}
        <div className="mt-3 flex items-center gap-2">
          {step.action ? (
            <Button variant="outline" size="xs" onClick={() => setNote(step.action!.run())}>
              {step.action.label}
            </Button>
          ) : null}
          <div className="flex-1" />
          {index > 0 ? (
            <Button variant="ghost" size="xs" onClick={() => go(index - 1)}>
              {translate('tenure.tutorial.prev', 'Back')}
            </Button>
          ) : null}
          {waiting ? (
            <span className="text-xs text-sky-600 dark:text-sky-400">
              {translate('tenure.tutorial.waitClick', 'Click the highlighted item')}
            </span>
          ) : (
            <Button size="xs" onClick={() => go(last ? null : index + 1)}>
              {last
                ? translate('tenure.tutorial.done', 'Finish')
                : translate('tenure.tutorial.next', 'Next')}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
