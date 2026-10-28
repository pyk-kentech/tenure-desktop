import { translate } from '@/i18n/i18n'

// tenure: upstream contextual tours ship most step copy as plain English (src/shared/contextual-tours.ts).
// Keyed by `<tour id>#<step index>` for steps without a stable id, so the copy follows the language
// the user picked (DESIGN.md 36.31). Thunks keep translate() out of module scope.
export const STEP_COPY_BY_POSITION: Record<string, { title: () => string; body: () => string }> = {
  'workspace-board#0': {
    title: () => translate('tenure.tours.board.0.title', 'Plan work on the board'),
    body: () =>
      translate(
        'tenure.tours.board.0.body',
        'Use the board when you want to see workspaces by status instead of by project.'
      )
  },
  'workspace-board#1': {
    title: () => translate('tenure.tours.board.1.title', 'Move work through lanes'),
    body: () =>
      translate(
        'tenure.tours.board.1.body',
        'Drag workspaces between lanes as their status changes.'
      )
  },
  'workspace-agent-sessions#0': {
    title: () => translate('tenure.tours.sessions.0.title', 'Split a terminal pane'),
    body: () =>
      translate(
        'tenure.tours.sessions.0.body',
        'Open a second terminal pane with {terminal.splitRight}, or right-click the pane for split options.'
      )
  },
  'workspace-agent-sessions#1': {
    title: () => translate('tenure.tours.sessions.1.title', 'Start another task in parallel'),
    body: () =>
      translate(
        'tenure.tours.sessions.1.body',
        'Each worktree gets its own branch, so parallel work stays separate.'
      )
  },
  'browser#0': {
    title: () => translate('tenure.tours.browser.0.title', 'Grab page context for agents'),
    body: () =>
      translate(
        'tenure.tours.browser.0.body',
        "Use the grab tool to copy a page element's context for agents."
      )
  },
  'browser#1': {
    title: () => translate('tenure.tours.browser.1.title', 'Mark design feedback in place'),
    body: () =>
      translate(
        'tenure.tours.browser.1.body',
        'Annotate elements and send those notes to an agent.'
      )
  },
  'browser#2': {
    title: () => translate('tenure.tours.browser.2.title', 'Stay logged in'),
    body: () =>
      translate(
        'tenure.tours.browser.2.body',
        'Bring your existing logins into Orca to stay signed in immediately.'
      )
  },
  'tasks#0': {
    title: () => translate('tenure.tours.tasks.0.title', 'Choose the work source'),
    body: () =>
      translate(
        'tenure.tours.tasks.0.body',
        'Switch between connected providers and project filters without changing pages.'
      )
  },
  'tasks#1': {
    title: () => translate('tenure.tours.tasks.1.title', 'Filter to the work you need'),
    body: () =>
      translate(
        'tenure.tours.tasks.1.body',
        'Use presets and search to narrow issues, reviews, merge requests, or tasks.'
      )
  },
  'tasks#2': {
    title: () => translate('tenure.tours.tasks.2.title', 'Start from work items'),
    body: () =>
      translate(
        'tenure.tours.tasks.2.body',
        'Use Start or Open on a task, issue, review, or merge request to bring its context into a workspace.'
      )
  },
  'floating-workspace#0': {
    title: () => translate('tenure.tours.floating.0.title', 'Run an agent across every repo'),
    body: () =>
      translate(
        'tenure.tours.floating.0.body',
        'Agents here run in any folder you choose. Point one at the directory above your services to work across all your repos at once.'
      )
  },
  'floating-workspace#1': {
    title: () => translate('tenure.tours.floating.1.title', 'Or use it as a scratchpad'),
    body: () =>
      translate(
        'tenure.tours.floating.1.body',
        'Open agents, scratch terminals, notes, and browser tabs without cluttering the worktree you’re focused on.'
      )
  },
  'workspace-creation#0': {
    title: () => translate('tenure.tours.creation.0.title', 'Pick a project'),
    body: () =>
      translate(
        'tenure.tours.creation.0.body',
        'Orca isolates each task in its own worktree, branched off your base.'
      )
  },
  'workspace-creation#1': {
    title: () => translate('tenure.tours.creation.1.title', 'Name it, or start from existing work'),
    body: () =>
      translate(
        'tenure.tours.creation.1.body',
        'Start from a linked task for a short issue or PR name. Or leave it blank to auto-name it from your first agent message.'
      )
  },
  'workspace-creation#2': {
    title: () => translate('tenure.tours.creation.2.title', 'Choose what agent starts the work'),
    body: () =>
      translate(
        'tenure.tours.creation.2.body',
        'Pick the agent that should be opened when this worktree is created.'
      )
  }
}

/** Action button labels the tour definitions carry as plain English. */
export function localizeTourActionLabel(label: string): string {
  switch (label) {
    case 'Split terminal':
      return translate('tenure.tours.action.splitTerminal', 'Split terminal')
    case 'Got it':
      return translate('tenure.tours.action.gotIt', 'Got it')
    case 'Browser settings':
      return translate('tenure.tours.action.browserSettings', 'Browser settings')
    default:
      return label
  }
}
