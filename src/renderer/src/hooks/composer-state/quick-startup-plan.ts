import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { AgentStartupShell } from '../../../../shared/tui-agent-startup-shell'
import type { AgentStartedTelemetry } from '@/lib/worktree-startup-payload'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import type { AgentStartupPlan } from '@/lib/tui-agent-startup'
import { buildAgentDraftLaunchPlan, buildAgentStartupPlan } from '@/lib/tui-agent-startup'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../../shared/tui-agent-launch-defaults'
import { tuiAgentToAgentKind } from '@/lib/telemetry'
import {
  buildTenureRelayCoordinatorPrompt,
  normalizeTenureRelayOptions,
  TENURE_RELAY_MAX_ROUNDS_ENV,
  tenureRelayCodexArgs,
  type TenureRelayOptions
} from '../../../../shared/tenure-relay'
import {
  requireExecutionHostPlatform,
  type ExecutionHostPlatformFact
} from '@/lib/execution-host-facts'

export type QuickComposerStartupInput = {
  agent: TuiAgent | null
  prompt: string
  draftPrompt: string | null | undefined
  settings: GlobalSettings | null | undefined
  /** Withheld fails an agent launch; a workspace created without an agent never reads it. */
  launchHost: ExecutionHostPlatformFact
  shell: AgentStartupShell | null | undefined
  isRemote: boolean
  telemetrySource: WorktreeCreationRequest['telemetrySource']
  /** tenure relay (DESIGN.md 36.24): the agent is the coordinator Codex and `prompt` is its task. */
  tenureRelay?: TenureRelayOptions | null
}

export type QuickComposerStartup = {
  startupPlan: AgentStartupPlan | null
  backendStartup: WorktreeCreationRequest['startup']
  telemetry: AgentStartedTelemetry | null
}

export function buildQuickComposerStartup(input: QuickComposerStartupInput): QuickComposerStartup {
  const { agent, settings } = input
  const relayOptions = agent === 'codex' ? (input.tenureRelay ?? null) : null
  const relay = relayOptions
    ? {
        options: normalizeTenureRelayOptions(relayOptions),
        // Why: dev builds put orca-dev on the terminal PATH; packaged builds put orca.
        cliCommand: import.meta.env.DEV ? 'orca-dev' : 'orca'
      }
    : null
  const draftPrompt = relay ? null : input.draftPrompt
  const prompt = relay
    ? buildTenureRelayCoordinatorPrompt({
        task: input.prompt,
        options: relay.options,
        cliCommand: relay.cliCommand,
        workerBaseArgs: resolveTuiAgentLaunchArgs('codex', settings?.agentDefaultArgs)
      })
    : input.prompt
  const baseArgs =
    agent === null ? '' : resolveTuiAgentLaunchArgs(agent, settings?.agentDefaultArgs)
  const baseEnv = agent === null ? {} : resolveTuiAgentLaunchEnv(agent, settings?.agentDefaultEnv)
  const agentArgs = relay
    ? [
        baseArgs,
        ...tenureRelayCodexArgs(relay.options.coordinatorModel, relay.options.coordinatorEffort)
      ]
        .filter(Boolean)
        .join(' ')
    : baseArgs
  const agentEnv = relay
    ? { ...baseEnv, [TENURE_RELAY_MAX_ROUNDS_ENV]: String(relay.options.maxRounds) }
    : baseEnv
  const draftLaunchPlan =
    agent === null || !draftPrompt
      ? null
      : buildAgentDraftLaunchPlan({
          agent,
          draft: draftPrompt,
          cmdOverrides: settings?.agentCmdOverrides ?? {},
          agentArgs,
          agentEnv,
          platform: requireExecutionHostPlatform(input.launchHost),
          shell: input.shell ?? undefined,
          isRemote: input.isRemote
        })
  let startupPlan: AgentStartupPlan | null = null
  if (draftLaunchPlan) {
    startupPlan = {
      agent: draftLaunchPlan.agent,
      launchCommand: draftLaunchPlan.launchCommand,
      expectedProcess: draftLaunchPlan.expectedProcess,
      followupPrompt: null,
      launchConfig: draftLaunchPlan.launchConfig,
      ...(draftLaunchPlan.startupCommandDelivery
        ? { startupCommandDelivery: draftLaunchPlan.startupCommandDelivery }
        : {}),
      ...(draftLaunchPlan.env ? { env: draftLaunchPlan.env } : {})
    }
  } else if (agent !== null) {
    startupPlan = buildAgentStartupPlan({
      agent,
      prompt,
      cmdOverrides: settings?.agentCmdOverrides ?? {},
      agentArgs,
      agentEnv,
      platform: requireExecutionHostPlatform(input.launchHost),
      shell: input.shell ?? undefined,
      isRemote: input.isRemote,
      allowEmptyPromptLaunch: true
    })
    if (startupPlan && draftPrompt) {
      startupPlan.draftPrompt = draftPrompt
    }
  }
  const telemetry: AgentStartedTelemetry | null =
    agent === null
      ? null
      : {
          agent_kind: tuiAgentToAgentKind(agent),
          launch_source:
            input.telemetrySource === 'onboarding' ? 'onboarding' : 'new_workspace_composer',
          request_kind: 'new'
        }
  const backendStartup =
    startupPlan && !startupPlan.draftPrompt && !startupPlan.followupPrompt
      ? {
          command: startupPlan.launchCommand,
          ...(startupPlan.env ? { env: startupPlan.env } : {}),
          launchConfig: startupPlan.launchConfig,
          ...(agent ? { launchAgent: agent } : {}),
          ...(startupPlan.startupCommandDelivery
            ? { startupCommandDelivery: startupPlan.startupCommandDelivery }
            : {}),
          ...(telemetry ? { telemetry } : {})
        }
      : undefined
  return { startupPlan, backendStartup, telemetry }
}
