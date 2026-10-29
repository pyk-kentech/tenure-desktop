import { useCallback, useState } from 'react'
import { translate } from '@/i18n/i18n'
import type { WorkflowScope } from './workflow-editor-api'
import { workflowTitle } from './workflow-titles'

// tenure: where the editor saves (DESIGN.md 36.37 M52). The user types a display name in any
// language; the file name is the engine's business. Editing one of your own workflows saves over
// its file unless "save as new" is picked.

export type SaveTarget = ReturnType<typeof useSaveTarget>

export function useSaveTarget(project: string | null) {
  const [title, setTitle] = useState('')
  const [ownFile, setOwnFile] = useState<string | null>(null)
  const [keepFile, setKeepFile] = useState(true)
  const [scope, setScope] = useState<WorkflowScope>(project ? 'project' : 'user')

  const copyOf = (name: string) =>
    translate('tenure.workflow.copyOf', '{{value0}} copy', { value0: name })

  const fromTemplate = useCallback((id: string, source: string, name: string) => {
    const own = source === 'project' || source === 'user'
    setTitle(own ? workflowTitle(id, name) : copyOf(workflowTitle(id, name)))
    setOwnFile(own ? id : null)
    setKeepFile(true)
    if (own) {
      setScope(source === 'user' ? 'user' : 'project')
    }
  }, [])

  const fromRun = useCallback((name: string) => {
    setTitle(copyOf(workflowTitle(name, name)))
    setOwnFile(null)
  }, [])

  const saved = useCallback((id: string) => {
    setOwnFile(id)
    setKeepFile(true)
  }, [])

  return {
    title,
    setTitle,
    ownFile,
    // The file a save writes over, or null for a new file.
    fileId: keepFile ? ownFile : null,
    keepFile,
    setKeepFile,
    scope,
    setScope,
    fromTemplate,
    fromRun,
    saved
  }
}
