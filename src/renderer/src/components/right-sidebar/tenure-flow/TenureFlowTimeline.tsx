import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { tenureCall, type TenureRunDetail, type TenureRunEntry } from './tenure-flow-api'
import { stepLabel } from './tenure-flow-labels'

function verdictText(entry: TenureRunEntry): string | null {
  if (entry.meta.step === 'test') {
    return entry.meta.test_status ?? null
  }
  const status = entry.verdict?.status
  if (status === 'APPROVED') {
    return translate('tenure.flow.verdict.approved', 'Approved')
  }
  if (status === 'CHANGES_REQUESTED') {
    return translate('tenure.flow.verdict.changes', 'Changes requested')
  }
  return null
}

function EntryBody({
  project,
  runId,
  file
}: {
  project: string
  runId: string
  file: string
}): React.JSX.Element {
  const [body, setBody] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    tenureCall<{ body: string }>({
      method: 'GET',
      path: '/api/entry',
      query: { project, run: runId, file }
    })
      .then((entry) => {
        if (alive) {
          setBody(entry.body)
        }
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      alive = false
    }
  }, [project, runId, file])
  if (error) {
    return <div className="px-2 py-1 text-xs text-destructive">{error}</div>
  }
  return (
    <pre className="scrollbar-sleek max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 px-2 py-1.5 font-mono text-2xs leading-relaxed">
      {body ?? '…'}
    </pre>
  )
}

/** Each agent call of the run in order, expandable to its transcript; the result summary first. */
export function TenureFlowTimeline({
  detail,
  project,
  runId
}: {
  detail: TenureRunDetail
  project: string
  runId: string
}): React.JSX.Element {
  const [open, setOpen] = useState<string | null>(null)
  const report = detail.state.report && !detail.live ? detail.state.report : null
  const rows = detail.entries.filter((entry) => entry.name !== report)
  return (
    <div className="flex flex-col gap-0.5">
      {report ? (
        <div className="mb-1">
          <button
            type="button"
            className="flex w-full items-center gap-1 py-1 text-left text-xs font-medium"
            onClick={() => setOpen(open === report ? null : report)}
          >
            {open === report ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            {translate('tenure.flow.summary', 'Result summary')}
          </button>
          {open === report ? <EntryBody project={project} runId={runId} file={report} /> : null}
        </div>
      ) : null}
      {rows.length === 0 && !detail.live ? (
        <div className="text-xs text-muted-foreground">
          {translate('tenure.flow.noEntries', 'No agent calls yet.')}
        </div>
      ) : null}
      {rows.map((entry) => {
        const failed =
          entry.meta.step !== 'test' &&
          (entry.meta.ok === 'false' || entry.label.endsWith('_failed'))
        const verdict = verdictText(entry)
        return (
          <div key={entry.name}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-accent/60"
              onClick={() => setOpen(open === entry.name ? null : entry.name)}
            >
              <span className="w-5 shrink-0 font-mono text-2xs text-muted-foreground">
                {String(entry.seq).padStart(2, '0')}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {entry.meta.role || entry.meta.agent}
              </span>
              <span className={`min-w-0 flex-1 truncate ${failed ? 'text-destructive' : ''}`}>
                {stepLabel(entry.meta.step)}
                {entry.meta.round && entry.meta.round !== '0' ? ` · ${entry.meta.round}` : ''}
              </span>
              {verdict ? (
                <span className="shrink-0 text-2xs text-muted-foreground">{verdict}</span>
              ) : null}
            </button>
            {open === entry.name ? (
              <EntryBody project={project} runId={runId} file={entry.name} />
            ) : null}
          </div>
        )
      })}
      {detail.live ? (
        <div className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
          <span className="inline-block size-2.5 animate-spin rounded-full border-2 border-agent-working/30 border-t-agent-working" />
          {detail.current_call
            ? `${detail.current_call.agent} · ${stepLabel(detail.current_call.step)}`
            : translate('tenure.flow.preparing', 'Preparing the next step')}
        </div>
      ) : null}
    </div>
  )
}
