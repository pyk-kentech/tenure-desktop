import { translate } from '@/i18n/i18n'
import type { StepKind } from './workflow-model'
import type { GraphProblem } from './workflow-convert'

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
    case 'branch':
      return translate('tenure.workflow.kind.branch', 'Branch')
    case 'continue':
      return translate('tenure.workflow.kind.continue', 'Additional fixes')
    case 'parallel':
      return translate('tenure.workflow.kind.parallel', 'Parallel')
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
    case 'branch':
      return translate(
        'tenure.workflow.help.branch',
        'Looks at the last result and takes the yes or the no line. Point a line back to an earlier step to repeat it.'
      )
    case 'continue':
      return translate(
        'tenure.workflow.help.continue',
        'Takes over the finished implementation and runs more fix → test → review rounds, possibly with other roles.'
      )
    case 'parallel':
      return translate(
        'tenure.workflow.help.parallel',
        'Runs read-only steps (explore, audit) at the same time, then goes on along its next line.'
      )
  }
}

export function outputLabel(handle: string): string {
  switch (handle) {
    case 'yes':
      return translate('tenure.workflow.out.yes', 'Yes')
    case 'no':
      return translate('tenure.workflow.out.no', 'No')
    case 'fork':
      return translate('tenure.workflow.out.fork', 'Parallel steps')
    default:
      return translate('tenure.workflow.out.next', 'Next')
  }
}

export function checkLabel(check: unknown): string {
  switch (check) {
    case 'tests_pass':
      return translate('tenure.workflow.cond.testsPass', 'Did the tests pass?')
    case 'audit_clean':
      return translate('tenure.workflow.cond.auditClean', 'Was the audit clean?')
    default:
      return translate('tenure.workflow.cond.approved', 'Was it approved?')
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

export function orderProblemText(problem: GraphProblem): string | null {
  switch (problem) {
    case 'empty':
      return translate('tenure.workflow.problem.empty', 'Add at least one step.')
    case 'split':
      return translate(
        'tenure.workflow.problem.split',
        'Some steps are not reached from the start. Connect them (a right dot to the left dot of the next step).'
      )
    case 'loop':
      return translate(
        'tenure.workflow.problem.loop',
        'Every step has a line coming in, so there is no start. Remove the line into the first step.'
      )
    case 'start':
      return translate(
        'tenure.workflow.problem.start',
        'There must be exactly one start: only the first step may have no line coming in.'
      )
    default:
      return null
  }
}
