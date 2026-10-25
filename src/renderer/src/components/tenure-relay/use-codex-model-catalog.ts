import { useEffect, useState } from 'react'
import type {
  AgentSessionModelCatalogResult,
  AgentSessionModelOption
} from '../../../../shared/agent-session-wire'
import { CODEX_SESSION_OPTION_CATALOG } from '../../../../shared/agent-session-option-catalog-claude-codex'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import {
  readHostModelCatalogSnapshot,
  recordHostModelCatalogSnapshot
} from '@/runtime/host-model-catalog-snapshots'

const LOCAL = { kind: 'local' } as const

export type TenureRelayModel = {
  id: string
  label: string
  isDefault: boolean
  defaultEffort?: string
  efforts: { value: string; label: string }[]
}

function fromHost(models: AgentSessionModelOption[]): TenureRelayModel[] {
  return models.map((model) => ({
    id: model.id,
    label: model.label,
    isDefault: model.isDefault,
    ...(model.defaultEffort ? { defaultEffort: model.defaultEffort } : {}),
    efforts: model.efforts.map((effort) => ({ value: effort.value, label: effort.label }))
  }))
}

/** Orca's short seed list, for when the host has not listed the account's models. */
function seedModels(): TenureRelayModel[] {
  return CODEX_SESSION_OPTION_CATALOG.models.map((model) => {
    const effort = model.options?.find((option) => option.id === 'effort')
    return {
      id: model.id,
      label: model.label,
      isDefault: false,
      efforts:
        effort?.kind.type === 'select'
          ? effort.kind.choices.map((choice) => ({ value: choice.value, label: choice.label }))
          : []
    }
  })
}

function listed(catalog: AgentSessionModelCatalogResult | undefined): TenureRelayModel[] | null {
  return catalog && catalog.origin !== 'unknown' && catalog.models.length > 0
    ? fromHost(catalog.models)
    : null
}

/**
 * tenure relay (DESIGN.md 36.25): the Codex models this account lists, with each model's own
 * effort levels — the same answer the app's chat pickers use. Falls back to Orca's seed list.
 */
export function useCodexModelCatalog(): { models: TenureRelayModel[]; fromAccount: boolean } {
  const [models, setModels] = useState<TenureRelayModel[] | null>(() =>
    listed(readHostModelCatalogSnapshot(LOCAL, 'codex', { newLaunch: true, seedsModel: true }))
  )
  useEffect(() => {
    let live = true
    void callStructuredAgentSession<AgentSessionModelCatalogResult>(
      LOCAL,
      'agentSession.modelCatalog',
      { agent: 'codex' }
    )
      .then((catalog) => {
        recordHostModelCatalogSnapshot(LOCAL, 'codex', null, catalog)
        const next = listed(catalog)
        if (live && next) {
          setModels(next)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return models ? { models, fromAccount: true } : { models: seedModels(), fromAccount: false }
}
