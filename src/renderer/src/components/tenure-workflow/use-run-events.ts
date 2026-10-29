import { useEffect, useState } from 'react'
import { tenureCall } from '../right-sidebar/tenure-flow/tenure-flow-api'
import type { RunEvent } from './step-timeline'

// tenure: the run's events for the live run view (DESIGN.md 36.35). Reads everything once, then
// only what comes after the last seen seq, every second while the run is live.

const POLL_MS = 1000
// The engine returns at most this many per read; a full page means more are waiting.
const PAGE = 1000

export function useRunEvents(
  project: string | null,
  runId: string | null,
  live: boolean,
  enabled: boolean
): RunEvent[] {
  // Why: keyed by run id so another run never shows this run's events.
  const [got, setGot] = useState<{ runId: string; events: RunEvent[] } | null>(null)

  useEffect(() => {
    if (!enabled || !project || !runId) {
      return
    }
    let alive = true
    let timer: number | undefined
    let last = 0
    let all: RunEvent[] = []
    const read = async () => {
      try {
        const res = await tenureCall<{ events: RunEvent[]; last_seq: number }>({
          method: 'GET',
          path: '/api/events',
          query: { project, run: runId, since: String(last) }
        })
        if (!alive) {
          return
        }
        if (res.last_seq < last) {
          // Why: the log was rewritten (seq went back); start over from the beginning.
          last = 0
          all = []
        } else if (res.events.length) {
          last = res.last_seq
          all = [...all, ...res.events]
          setGot({ runId, events: all })
        }
        if (res.events.length >= PAGE) {
          void read()
        } else if (live) {
          timer = window.setTimeout(() => void read(), POLL_MS)
        }
      } catch {
        // Why: a missed read is retried on the next tick; the run view keeps its last picture.
        if (alive && live) {
          timer = window.setTimeout(() => void read(), POLL_MS * 3)
        }
      }
    }
    void read()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [project, runId, live, enabled])

  return got && got.runId === runId ? got.events : []
}
