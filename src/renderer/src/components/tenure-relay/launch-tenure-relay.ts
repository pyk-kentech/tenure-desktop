import { useAppStore } from '@/store'
import { buildAgentStartupPlan } from '@/lib/tui-agent-startup'
import { persistAgentLaunchTabOrder } from '@/lib/launch-agent-tab-order'
import { resolveAgentLaunchExecutionContext } from '@/lib/launch-agent-execution-context'
import { tuiAgentToAgentKind } from '@/lib/telemetry'
import {
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../../shared/tui-agent-launch-defaults'
import { tenureRelayLaunch, type TenureRelayOptions } from '../../../../shared/tenure-relay'

/**
 * tenure relay (DESIGN.md 36.25): opens a coordinator Codex in a new terminal tab of an existing
 * workspace. Why not `launchAgentInNewTab`: the coordinator needs its own env (the round cap),
 * which that launcher takes from settings only; this builds the plan the same way the composer
 * does and hands the tab a pending startup. Local workspaces only (36.24).
 */
export function launchTenureRelayInNewTab(args: {
  worktreeId: string
  groupId?: string
  task: string
  options: TenureRelayOptions
}): { tabId: string } | { refused: 'remote' | 'unavailable' } {
  const store = useAppStore.getState()
  const context = resolveAgentLaunchExecutionContext(store, { worktreeId: args.worktreeId })
  if (!context) {
    return { refused: 'unavailable' }
  }
  if (context.isRemote) {
    return { refused: 'remote' }
  }
  const settings = store.settings
  const relay = tenureRelayLaunch({
    task: args.task,
    options: args.options,
    // Why: dev builds put orca-dev on the terminal PATH; packaged builds put orca.
    cliCommand: import.meta.env.DEV ? 'orca-dev' : 'orca',
    baseArgs: resolveTuiAgentLaunchArgs('codex', settings?.agentDefaultArgs),
    baseEnv: resolveTuiAgentLaunchEnv('codex', settings?.agentDefaultEnv)
  })
  const plan = buildAgentStartupPlan({
    agent: 'codex',
    prompt: relay.prompt,
    cmdOverrides: settings?.agentCmdOverrides ?? {},
    platform: context.resolvedLaunchPlatform,
    shell: context.queuedShell,
    isRemote: false,
    agentArgs: relay.agentArgs,
    agentEnv: relay.agentEnv
  })
  if (!plan) {
    return { refused: 'unavailable' }
  }
  const tab = store.createTab(args.worktreeId, args.groupId, undefined, {
    pendingStartup: {
      command: plan.launchCommand,
      ...(plan.env ? { env: plan.env } : {}),
      ...(plan.startupCommandDelivery
        ? { startupCommandDelivery: plan.startupCommandDelivery }
        : {}),
      launchConfig: plan.launchConfig,
      launchAgent: 'codex',
      telemetry: {
        agent_kind: tuiAgentToAgentKind('codex'),
        launch_source: 'tab_bar_quick_launch',
        request_kind: 'new'
      }
    }
  })
  store.setActiveTabType('terminal', args.worktreeId)
  persistAgentLaunchTabOrder(args.worktreeId, tab.id)
  return { tabId: tab.id }
}
