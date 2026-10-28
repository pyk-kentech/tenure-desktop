import { translate } from '@/i18n/i18n'
import type { StepKind } from './workflow-model'

export function kindLabel(kind: StepKind): string {
  switch (kind) {
    case 'explore':
      return translate('tenure.workflow.kind.explore', 'Explore the code')
    case 'debate':
      return translate('tenure.workflow.kind.debate', 'Design debate')
    case 'build':
      return translate('tenure.workflow.kind.build', 'Implement + review')
    case 'audit':
      return translate('tenure.workflow.kind.audit', 'Audit')
  }
}

export function kindHelp(kind: StepKind): string {
  switch (kind) {
    case 'explore':
      return translate(
        'tenure.workflow.help.explore',
        'One role reads the project and writes notes for the next steps.'
      )
    case 'debate':
      return translate(
        'tenure.workflow.help.debate',
        'Proposers write designs, criticise each other, and the synthesiser merges them into DESIGN.md.'
      )
    case 'build':
      return translate(
        'tenure.workflow.help.build',
        'The implementer writes code; reviewers review and the fix rounds repeat until approved. A rival turns it into a race of two drafts.'
      )
    case 'audit':
      return translate(
        'tenure.workflow.help.audit',
        'After approval, auditors check the whole change once more.'
      )
  }
}

export function slotLabel(slot: string): string {
  switch (slot) {
    case 'role':
      return translate('tenure.workflow.slot.role', 'Explorer')
    case 'proposers':
      return translate('tenure.workflow.slot.proposers', 'Proposers')
    case 'synth':
      return translate('tenure.workflow.slot.synth', 'Synthesiser')
    case 'implementer':
      return translate('tenure.workflow.slot.implementer', 'Implementer')
    case 'reviewers':
      return translate('tenure.workflow.slot.reviewers', 'Reviewers')
    case 'rivals':
      return translate('tenure.workflow.slot.rivals', 'Rival')
    case 'arbiter':
      return translate('tenure.workflow.slot.arbiter', 'Arbiter')
    case 'roles':
      return translate('tenure.workflow.slot.roles', 'Auditors')
    default:
      return slot
  }
}

export function orderProblemText(problem: 'none' | 'empty' | 'split' | 'loop'): string | null {
  switch (problem) {
    case 'empty':
      return translate('tenure.workflow.problem.empty', 'Add at least one step.')
    case 'split':
      return translate(
        'tenure.workflow.problem.split',
        'Connect the steps in one line (the right dot of a step to the left dot of the next).'
      )
    case 'loop':
      return translate('tenure.workflow.problem.loop', 'The steps form a loop. Remove one link.')
    default:
      return null
  }
}
