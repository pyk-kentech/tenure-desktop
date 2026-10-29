import { useEffect, useState } from 'react'
import { listModels, type ModelChoices } from './workflow-editor-api'

// tenure: model and effort choices for a role (DESIGN.md 36.37 M52), read once per window.

let cached: Promise<ModelChoices> | null = null

export function useModelChoices(): ModelChoices | null {
  const [choices, setChoices] = useState<ModelChoices | null>(null)
  useEffect(() => {
    let alive = true
    cached ??= listModels()
    cached
      .then((c) => {
        if (alive) {
          setChoices(c)
        }
      })
      .catch(() => {
        // Why: without the list the fields still work; let the next editor open try again.
        cached = null
      })
    return () => {
      alive = false
    }
  }, [])
  return choices
}

/** Options for a select: the known ones, plus the current value if it is not among them. */
export function withCurrent(options: { id: string; label: string }[], current?: string) {
  return current && !options.some((o) => o.id === current)
    ? [...options, { id: current, label: current }]
    : options
}
