import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'

// tenure: in-app walkthrough (DESIGN.md 36.31 M46). Each step points at one element and may offer
// to do the step for the user. Starting a run is only ever done as a mock run.

export type TutorialStep = {
  id: string
  title: string
  body: string
  target?: () => Element | null
  action?: { label: string; run: () => string | null }
}

export function tourTarget(id: string): Element | null {
  return document.querySelector(`[data-tenure-tour="${id}"]`)
}

function click(id: string): string | null {
  const el = tourTarget(id)
  if (el instanceof HTMLElement) {
    el.click()
    return null
  }
  return notFound()
}

function notFound(): string {
  return translate(
    'tenure.tutorial.notFound',
    'The item is not on screen. Finish the previous step and try again.'
  )
}

function mockBox(): HTMLElement | null {
  const box = tourTarget('mock')?.querySelector('[role="checkbox"]')
  return box instanceof HTMLElement ? box : null
}

function setTextarea(el: Element | null, value: string): boolean {
  if (!(el instanceof HTMLTextAreaElement)) {
    return false
  }
  // Why: React tracks the value itself; set it through the native setter so onChange fires.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

function flowsTab(): Element | null {
  const label = translate('tenure.flow.title', 'Flows')
  return (
    [...document.querySelectorAll('button[aria-label]')].find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(label)
    ) ?? null
  )
}

export function tutorialSteps(): TutorialStep[] {
  return [
    {
      id: 'welcome',
      title: translate('tenure.tutorial.welcome.title', 'Getting started with tenure'),
      body: translate(
        'tenure.tutorial.welcome.body',
        'tenure lets Claude and Codex pass implementation, review and fixes back and forth in rounds until the work is done. This walkthrough uses a mock run, so it uses none of your subscription. It takes about three minutes.'
      )
    },
    {
      id: 'flows-tab',
      title: translate('tenure.tutorial.flowsTab.title', 'Flows panel'),
      body: translate(
        'tenure.tutorial.flowsTab.body',
        'The Flows tab in the right sidebar starts flows for the current workspace and shows their records.'
      ),
      target: flowsTab,
      action: {
        label: translate('tenure.tutorial.flowsTab.action', 'Open it for me'),
        run: () => {
          const s = useAppStore.getState()
          s.setRightSidebarOpen(true)
          s.setRightSidebarTab('tenure')
          return null
        }
      }
    },
    {
      id: 'new-flow',
      title: translate('tenure.tutorial.newFlow.title', 'New flow'),
      body: translate(
        'tenure.tutorial.newFlow.body',
        'New flow opens the start form. Each workspace runs in its own git worktree, so a flow never mixes with other work.'
      ),
      target: () => tourTarget('new-flow'),
      action: {
        label: translate('tenure.tutorial.newFlow.action', 'Open the form'),
        run: () => (tourTarget('task') ? null : click('new-flow'))
      }
    },
    {
      id: 'task',
      title: translate('tenure.tutorial.task.title', 'Task'),
      body: translate(
        'tenure.tutorial.task.body',
        'Describe what to build or fix as concretely as you can; clear requirements make the reviews sharper.'
      ),
      target: () => tourTarget('task'),
      action: {
        label: translate('tenure.tutorial.task.action', 'Fill in an example'),
        run: () =>
          setTextarea(
            tourTarget('task'),
            translate(
              'tenure.tutorial.task.sample',
              'Build a to-do list CLI with add, done and list commands.'
            )
          )
            ? null
            : notFound()
      }
    },
    {
      id: 'workflow-choice',
      title: translate('tenure.tutorial.choice.title', 'How the flow runs'),
      body: translate(
        'tenure.tutorial.choice.body',
        'Auto picks a way that suits the task. Quick implements and runs a short review; Race lets two agents build separately and keeps the better draft; Design debate agrees on a design before implementing. Workflows you build yourself appear in this list too.'
      ),
      target: () => tourTarget('workflow-choice')
    },
    {
      id: 'mock',
      title: translate('tenure.tutorial.mock.title', 'Mock run'),
      body: translate(
        'tenure.tutorial.mock.body',
        'A mock run shows the whole process without calling any agent. Clear this box for real work; from then on the run uses your subscription.'
      ),
      target: () => tourTarget('mock'),
      action: {
        label: translate('tenure.tutorial.mock.action', 'Select mock run'),
        run: () => {
          const box = mockBox()
          if (!box) {
            return notFound()
          }
          if (box.getAttribute('aria-checked') !== 'true') {
            box.click()
          }
          return null
        }
      }
    },
    {
      id: 'start',
      title: translate('tenure.tutorial.start.title', 'Start'),
      body: translate(
        'tenure.tutorial.start.body',
        'Start runs the flow. A mock run finishes within a minute.'
      ),
      target: () => tourTarget('start'),
      action: {
        label: translate('tenure.tutorial.start.action', 'Start as a mock run'),
        run: () => {
          // Why: never start a real (paid) run on the user's behalf.
          if (mockBox()?.getAttribute('aria-checked') !== 'true') {
            return translate('tenure.tutorial.start.needMock', 'Select mock run first.')
          }
          return click('start')
        }
      }
    },
    {
      id: 'timeline',
      title: translate('tenure.tutorial.timeline.title', 'Round records'),
      body: translate(
        'tenure.tutorial.timeline.body',
        'Implementation, review and fixes are recorded round by round. Expand an entry to read the agent’s reply, or open it in a tab with the icon on the right.'
      ),
      target: () => tourTarget('timeline')
    },
    {
      id: 'review',
      title: translate('tenure.tutorial.review.title', 'Review changes'),
      body: translate(
        'tenure.tutorial.review.body',
        'Opens every file changed since the flow started in a side-by-side diff. Mark files as viewed and leave line notes to request another fix round.'
      ),
      target: () => tourTarget('review')
    },
    {
      id: 'workflow-button',
      title: translate('tenure.tutorial.editor.title', 'Workflow editor'),
      body: translate(
        'tenure.tutorial.editor.body',
        'Workflows opens an editor where you decide, as nodes, who handles which step.'
      ),
      target: () => tourTarget('workflow-button'),
      action: {
        label: translate('tenure.tutorial.editor.action', 'Open the editor'),
        run: () => (tourTarget('editor-canvas') ? null : click('workflow-button'))
      }
    },
    {
      id: 'editor-canvas',
      title: translate('tenure.tutorial.canvas.title', 'Nodes and connections'),
      body: translate(
        'tenure.tutorial.canvas.body',
        'Role nodes (below) say which agent and model work; step nodes (above) say what happens. Drag a role’s top connector onto a step’s slot to assign it, and connect a step’s right connector to the next step’s left connector to set the order.'
      ),
      target: () => tourTarget('editor-canvas')
    },
    {
      id: 'editor-controls',
      title: translate('tenure.tutorial.controls.title', 'Branch, additional fixes, parallel'),
      body: translate(
        'tenure.tutorial.controls.body',
        'A branch splits the path by approval or test results. Additional fixes hands the finished implementation to another role for more rounds. Parallel runs read-only steps such as exploring and auditing at the same time. Connecting back to an earlier step makes a loop; each node limits how often it repeats.'
      ),
      target: () => tourTarget('editor-controls')
    },
    {
      id: 'editor-check',
      title: translate('tenure.tutorial.check.title', 'Check and save'),
      body: translate(
        'tenure.tutorial.check.body',
        'Check validates the workflow with the engine’s own rules. Save it to this project or to My templates; saved workflows appear in the start form.'
      ),
      target: () => tourTarget('editor-check'),
      action: {
        label: translate('tenure.tutorial.check.action', 'Run the check'),
        run: () => click('editor-check')
      }
    },
    {
      id: 'finish',
      title: translate('tenure.tutorial.finish.title', 'You are ready'),
      body: translate(
        'tenure.tutorial.finish.body',
        'For real work, clear Mock run before starting. Progress also shows in the status window at the top of the screen. You can reopen this walkthrough any time from Guide in the Flows panel.'
      )
    }
  ]
}

export const TUTORIAL_EVENT = 'tenure:tutorial'

/** Opens the walkthrough from anywhere (the host lives in the status bar). */
export function startTenureTutorial(): void {
  window.dispatchEvent(new CustomEvent(TUTORIAL_EVENT))
}
