import { translate } from '@/i18n/i18n'
import { kindLabel, slotLabel } from './workflow-labels'
import { BLOCK_KINDS, CONTROL_KINDS, type StepKind } from './workflow-model'

// tenure: one name for a workflow everywhere — editor, start form, flow list (DESIGN.md 36.37 M52)
// — and the start form's "who does what" preview.

/** Built-ins get a translated title; saved workflows show the name they were saved with. */
export function workflowTitle(id: string, name?: string): string {
  switch (id) {
    case 'auto':
      return translate('tenure.wf.title.auto', 'Auto')
    case 'quick':
      return translate('tenure.wf.title.quick', 'Quick')
    case 'race':
      return translate('tenure.wf.title.race', 'Race')
    case 'classic':
      return translate('tenure.wf.title.classic', 'Design debate')
    case 'lean':
      return translate('tenure.wf.title.lean', 'Lean')
    case 'existing':
      return translate('tenure.wf.title.existing', 'Change existing code')
    case 'secure':
      return translate('tenure.wf.title.secure', 'Secure')
    default:
      return name?.trim() || id
  }
}

/** A short line under the start form's built-in choices. */
export function workflowHint(id: string): string {
  switch (id) {
    case 'auto':
      return translate('tenure.wf.hint.auto', 'picks one that suits the task')
    case 'quick':
      return translate('tenure.wf.hint.quick', 'implement + short review')
    case 'race':
      return translate('tenure.wf.hint.race', 'two drafts, keep the better')
    case 'classic':
      return translate('tenure.wf.hint.classic', 'agree on a design first')
    default:
      return ''
  }
}

export type PreviewRole = { name: string; agent: string; model?: string }
export type PreviewStep = Record<string, unknown> & { kind: string }

const SLOTS = [
  'role',
  'proposers',
  'synth',
  'implementer',
  'rivals',
  'reviewers',
  'arbiter',
  'roles'
]
const KINDS: readonly string[] = [...BLOCK_KINDS, ...CONTROL_KINDS]

function isKind(kind: string): kind is StepKind {
  return KINDS.includes(kind)
}

function names(v: unknown): string[] {
  return typeof v === 'string' ? [v] : Array.isArray(v) ? v.map(String) : []
}

function roleText(name: string, roles: PreviewRole[]): string {
  const r = roles.find((x) => x.name === name)
  if (!r) {
    return name
  }
  const who = r.model || r.agent
  return name === who ? name : `${name}(${who})`
}

/** One line per step: what happens and which role sits in each slot. */
export function workflowPreview(steps: PreviewStep[], roles: PreviewRole[]): string[] {
  return steps.map((s, i) => {
    const what = isKind(s.kind) ? kindLabel(s.kind) : s.kind
    const who = SLOTS.flatMap((slot) => {
      const list = names(s[slot])
      return list.length
        ? [`${slotLabel(slot)} ${list.map((n) => roleText(n, roles)).join(', ')}`]
        : []
    })
    return `${i + 1}. ${what}${who.length ? ` — ${who.join(' · ')}` : ''}`
  })
}
