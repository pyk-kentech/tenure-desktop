import React, { useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { NewWorkspaceComposerTenureRelaySettings } from '@/components/new-workspace/NewWorkspaceComposerTenureRelaySettings'
import {
  DEFAULT_TENURE_RELAY_OPTIONS,
  type TenureRelayOptions
} from '../../../../shared/tenure-relay'
import { launchTenureRelayInNewTab } from './launch-tenure-relay'

type TenureRelayModalData = { worktreeId?: string; groupId?: string }

/**
 * tenure relay (DESIGN.md 36.25): starts a coordinator Codex in a new tab of an existing
 * workspace. The task is optional; without one the coordinator waits for it in its terminal.
 */
export default function TenureRelayLaunchDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData as TenureRelayModalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const [options, setOptions] = useState<TenureRelayOptions>({ ...DEFAULT_TENURE_RELAY_OPTIONS })
  const [task, setTask] = useState('')
  const worktreeId = modalData.worktreeId
  if (!worktreeId) {
    return null
  }

  const start = (): void => {
    const result = launchTenureRelayInNewTab({
      worktreeId,
      ...(modalData.groupId ? { groupId: modalData.groupId } : {}),
      task,
      options
    })
    if ('refused' in result) {
      toast.error(
        result.refused === 'remote'
          ? translate(
              'tenure.relay.remoteUnsupported',
              'The relay runs only in local workspaces for now.'
            )
          : translate('tenure.relay.launchFailed', 'Could not start the coordinator Codex.')
      )
      return
    }
    closeModal()
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : closeModal())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{translate('tenure.relay.dialogTitle', 'Coordinator + worker')}</DialogTitle>
          <DialogDescription>
            {translate(
              'tenure.relay.dialogDescription',
              'Starts a coordinator Codex in a new tab of this workspace.'
            )}
          </DialogDescription>
        </DialogHeader>
        <NewWorkspaceComposerTenureRelaySettings value={options} onChange={setOptions} />
        <Textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          placeholder={translate(
            'tenure.relay.taskOptional',
            'Task (optional). Leave empty to give the task, links and files to the coordinator in its terminal.'
          )}
        />
        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            {translate('tenure.flow.cancel', 'Cancel')}
          </Button>
          <Button onClick={start}>{translate('tenure.relay.start', 'Start coordinator')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
