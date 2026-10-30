// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AGENT_CATALOG } from '@/lib/agent-catalog'
import { NewWorkspaceComposerAgentSection } from './NewWorkspaceComposerAgentSection'
import { tenureAgentNote } from './NewWorkspaceComposerTenureFlowSection'
import { DEFAULT_TENURE_RELAY_OPTIONS } from '../../../../shared/tenure-relay'

afterEach(cleanup)

// tenure: a flow or relay starts instead of the picked agent (DESIGN.md 36.40).
describe('tenure agent note', () => {
  it('names what starts instead of the agent', () => {
    expect(tenureAgentNote(false, null)).toBeUndefined()
    expect(tenureAgentNote(undefined, undefined)).toBeUndefined()
    expect(tenureAgentNote(true, null)).toMatch(/flow/)
    expect(tenureAgentNote(false, { ...DEFAULT_TENURE_RELAY_OPTIONS })).toMatch(/coordinator/)
  })

  it('replaces the agent picker with the note', () => {
    render(
      <TooltipProvider>
        <NewWorkspaceComposerAgentSection
          quickAgent="codex"
          onQuickAgentChange={vi.fn()}
          onOpenAgentSettings={vi.fn()}
          createDisabled={false}
          onCreate={vi.fn()}
          advancedOpen={false}
          onToggleAdvanced={vi.fn()}
          visibleQuickAgents={AGENT_CATALOG}
          defaultTuiAgent="blank"
          handleSetDefaultAgent={vi.fn()}
          agentReplacedNote="flow starts here"
        />
      </TooltipProvider>
    )
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('flow starts here')).toBeTruthy()
  })
})
