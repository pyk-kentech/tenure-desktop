import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'
import { tenureCall, type TenureRace } from './tenure-flow-api'

function DraftDiff({
  project,
  runId,
  role
}: {
  project: string
  runId: string
  role: string
}): React.JSX.Element {
  const [text, setText] = useState<string | null>(null)
  React.useEffect(() => {
    let alive = true
    tenureCall<{ text: string }>({
      method: 'GET',
      path: '/api/diff',
      query: { project, run: runId, draft: role }
    })
      .then((d) => {
        if (alive) {
          setText(d.text || translate('tenure.flow.draft.noDiff', 'No changes.'))
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setText(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      alive = false
    }
  }, [project, runId, role])
  return (
    <pre className="scrollbar-sleek max-h-72 overflow-auto whitespace-pre rounded bg-muted/50 px-2 py-1.5 font-mono text-2xs leading-relaxed">
      {text ?? '…'}
    </pre>
  )
}

/** Race drafts side by side: each draft's review, tests and size, and switching the kept draft (DESIGN.md 36.15). */
export function TenureFlowDrafts({
  race,
  project,
  runId,
  canPick,
  onPicked
}: {
  race: TenureRace
  project: string
  runId: string
  canPick: boolean
  onPicked: () => void
}): React.JSX.Element | null {
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const roles = race.drafters.filter((role) => race.drafts[role])
  if (roles.length === 0) {
    return null
  }
  const kept = race.picked ?? race.winner ?? null
  const pick = async (role: string) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await tenureCall<{ kept: string }>({
        method: 'POST',
        path: '/api/actions/pick',
        body: { project, run: runId, draft: role }
      })
      setMessage(
        translate('tenure.flow.draft.picked', 'Switched. Previous state kept as {{value0}}.', {
          value0: res.kept
        })
      )
      onPicked()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-1 rounded border border-border px-2 py-2">
      <div className="text-xs font-medium">
        {translate('tenure.flow.draft.title', 'Race drafts')}
      </div>
      {race.reason ? <div className="text-2xs text-muted-foreground">{race.reason}</div> : null}
      {roles.map((role) => {
        const draft = race.drafts[role]
        const review = draft.approved
          ? translate('tenure.flow.verdict.approved', 'Approved')
          : translate('tenure.flow.draft.blocking', '{{value0}} blocking', {
              value0: draft.blocking ?? '?'
            })
        return (
          <div key={role} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1 text-left"
                onClick={() => setOpen(open === role ? null : role)}
              >
                {open === role ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span className="font-medium">{role}</span>
                {role === kept ? (
                  <span className="text-2xs text-status-success">
                    {translate('tenure.flow.draft.kept', 'kept')}
                  </span>
                ) : null}
              </button>
              <span className="shrink-0 text-2xs text-muted-foreground">
                {review} · {draft.tests ?? '-'} · {draft.files}/{draft.lines}
              </span>
              {canPick && role !== kept ? (
                <Button variant="outline" size="xs" disabled={busy} onClick={() => void pick(role)}>
                  {translate('tenure.flow.draft.pick', 'Use this')}
                </Button>
              ) : null}
            </div>
            {open === role ? <DraftDiff project={project} runId={runId} role={role} /> : null}
          </div>
        )
      })}
      {message ? <div className="text-2xs text-muted-foreground">{message}</div> : null}
    </div>
  )
}
