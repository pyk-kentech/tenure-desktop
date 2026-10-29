import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Search } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { isImeOwnedKeyboardEvent } from '@/lib/ime-composition-keyboard-event'
import { BLOCK_KINDS, CONTROL_KINDS, type StepKind } from './workflow-model'
import { kindLabel } from './workflow-labels'

// tenure: ComfyUI-style "search to add" popup (DESIGN.md 36.33): double-click the canvas or drop a
// line on empty space, type, and pick a node.

export type AddItem = { type: 'role'; agent: 'claude' | 'codex' } | { type: 'step'; kind: StepKind }

function items(): { item: AddItem; label: string; keywords: string }[] {
  const roles = (['claude', 'codex'] as const).map((agent) => ({
    item: { type: 'role', agent } as AddItem,
    label:
      agent === 'claude'
        ? translate('tenure.workflow.palette.claude', 'Claude role')
        : translate('tenure.workflow.palette.codex', 'Codex role'),
    keywords: agent
  }))
  const steps = [...BLOCK_KINDS, ...CONTROL_KINDS].map((kind) => ({
    item: { type: 'step', kind } as AddItem,
    label: kindLabel(kind),
    keywords: kind
  }))
  return [...roles, ...steps]
}

export function WorkflowAddMenu({
  x,
  y,
  allowRoles,
  allowSteps,
  onPick,
  onClose
}: {
  x: number
  y: number
  allowRoles: boolean
  allowSteps: boolean
  onPick: (item: AddItem) => void
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items()
      .filter((i) => (i.item.type === 'role' ? allowRoles : allowSteps))
      .filter((i) => !q || i.label.toLowerCase().includes(q) || i.keywords.includes(q))
  }, [query, allowRoles, allowSteps])

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('mousedown', away)
    return () => window.removeEventListener('mousedown', away)
  }, [onClose])

  const choose = (index: number) => {
    const hit = list[index]
    if (hit) {
      onPick(hit.item)
    }
  }

  return (
    <div
      ref={box}
      data-tenure-tour="add-menu"
      className="absolute z-20 w-60 overflow-hidden rounded-md border bg-popover text-xs text-popover-foreground shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-2 border-b px-2.5">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            // Why: Enter while composing Hangul confirms the syllable, not a node.
            if (isImeOwnedKeyboardEvent(e)) {
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, list.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(active)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
          placeholder={translate('tenure.workflow.add.placeholder', 'Search nodes to add')}
          className="h-8 flex-1 bg-transparent outline-none"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1 scrollbar-sleek">
        {list.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground">
            {translate('tenure.workflow.add.empty', 'No matching nodes.')}
          </div>
        ) : (
          list.map((entry, i) => (
            <button
              key={entry.keywords}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${i === active ? 'bg-accent' : ''}`}
            >
              {entry.item.type === 'role' ? (
                <Bot className="size-3.5 text-muted-foreground" />
              ) : null}
              {entry.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
