import { translate } from '@/i18n/i18n'
import { click, notFound, tourTarget } from './tutorial-dom'
import type { TutorialStep } from './tutorial-steps'

// tenure: the walkthrough's workflow-editor part (DESIGN.md 36.31, 36.37 M52). The add-node and
// controls steps are hands-on: they move on when the user has done them.

export function editorSteps(): TutorialStep[] {
  let addArmed = false
  return [
    {
      id: 'workflow-button',
      title: translate('tenure.tutorial.editor.title', 'Workflow editor'),
      body: translate(
        'tenure.tutorial.editor.body',
        'Workflows opens an editor where you decide, as nodes, who handles which step. Click the highlighted Workflows button; the walkthrough moves on by itself.'
      ),
      target: () => tourTarget('workflow-button'),
      // Why: the user asked to click the button themselves; opening the editor moves on.
      waitFor: () => !!tourTarget('editor-canvas')
    },
    {
      id: 'editor-canvas',
      title: translate('tenure.tutorial.canvas.title', 'Nodes and connections'),
      body: translate(
        'tenure.tutorial.canvas.body',
        "Role nodes on the left say which agent and model work; step nodes say what happens. Drag a role's right connector onto a step's slot to assign it, and connect a step's right connector to the next step's left connector to set the order. The light on each line travels in the run direction."
      ),
      target: () => tourTarget('editor-canvas')
    },
    {
      id: 'editor-add',
      title: translate('tenure.tutorial.add.title', 'Try it: add a node'),
      body: translate(
        'tenure.tutorial.add.body',
        'Double-click an empty spot on the canvas. A search box opens; type a few letters and pick a node, or press Esc to close it. The walkthrough moves on when the box closes.'
      ),
      target: () => tourTarget('add-menu') ?? tourTarget('editor-canvas'),
      // Why: hands-on (DESIGN.md 36.37 M52): moves on once the search box has opened and closed.
      waitFor: () => {
        if (tourTarget('add-menu')) {
          addArmed = true
        }
        return addArmed && !tourTarget('add-menu')
      },
      action: {
        label: translate('tenure.tutorial.add.action', 'Open the search box'),
        run: () => {
          const pane = document.querySelector(
            '[data-tenure-tour="editor-canvas"] .react-flow__pane'
          )
          if (!(pane instanceof HTMLElement)) {
            return notFound()
          }
          const box = pane.getBoundingClientRect()
          pane.dispatchEvent(
            new MouseEvent('dblclick', {
              bubbles: true,
              clientX: box.left + box.width / 2,
              clientY: box.top + box.height - 60
            })
          )
          return null
        }
      }
    },
    {
      id: 'editor-lines',
      title: translate('tenure.tutorial.lines.title', 'Fixing and tidying lines'),
      body: translate(
        'tenure.tutorial.lines.body',
        'Hover a line and press the × near its end to remove it, or drag its end to another dot (dropping it on empty space cuts it). Hold Z and drag across several lines to tie them into a bundle. Ctrl+Z undoes any of this.'
      ),
      target: () => tourTarget('editor-canvas')
    },
    {
      id: 'editor-keys',
      title: translate('tenure.tutorial.keys.title', 'Try it: all controls'),
      body: translate(
        'tenure.tutorial.keys.body',
        'Press ? (or click the button at the top right) to see every control in one list.'
      ),
      target: () => tourTarget('editor-keys'),
      waitFor: () => !!document.querySelector('[data-tenure-tour="editor-keys"][data-open="true"]'),
      action: {
        label: translate('tenure.tutorial.keys.action', 'Show the list'),
        run: () => click('editor-keys')
      }
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
    }
  ]
}
