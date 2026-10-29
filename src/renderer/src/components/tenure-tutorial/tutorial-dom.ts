import { translate } from '@/i18n/i18n'

// tenure: finding and poking the walkthrough's targets (DESIGN.md 36.31 M46).

export function tourTarget(id: string): Element | null {
  return document.querySelector(`[data-tenure-tour="${id}"]`)
}

export function click(id: string): string | null {
  const el = tourTarget(id)
  if (el instanceof HTMLElement) {
    el.click()
    return null
  }
  return notFound()
}

export function notFound(): string {
  return translate(
    'tenure.tutorial.notFound',
    'The item is not on screen. Finish the previous step and try again.'
  )
}
