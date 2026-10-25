import React from 'react'
import { Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

/** tenure relay (DESIGN.md 36.25): the new-tab menu's entry to start a coordinator here. */
export function TenureRelayMenuItem({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  return (
    <DropdownMenuItem
      variant="launch"
      onSelect={() => openModal('tenure-relay', { worktreeId, groupId })}
    >
      <Workflow className="size-3.5" />
      <span className="flex-1">
        {translate('tenure.relay.menuItem', 'Coordinator + worker (tenure)…')}
      </span>
    </DropdownMenuItem>
  )
}
