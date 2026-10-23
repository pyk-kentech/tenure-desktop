import { spawnProcess } from '@orca/process-host'
import type { PipedChildProcess } from '@orca/process-host/process-spec'
import { forceTerminateProcessTree } from '@orca/process-host/process-tree-termination'
import type {
  TenureEngineRequest,
  TenureEngineResponse,
  TenureEngineState
} from '../../shared/tenure-engine-types'
import {
  resolveTenureEngineProgram,
  tenureEngineArgs,
  TENURE_ENGINE_ENV
} from './tenure-engine-command'
import { parseTenureLimits } from './tenure-engine-limits'

const READY_PREFIX = 'TENURE_READY '
const READY_TIMEOUT_MS = 60_000
const LIMITS_POLL_MS = 30_000
const REQUEST_TIMEOUT_MS = 30_000
const STDERR_TAIL_CHARS = 2000

/** Owns the engine child (`tenure ui --ready-line`) and proxies its token-guarded HTTP API for the renderer. */
export class TenureEngineService {
  private child: PipedChildProcess | null = null
  private origin: string | null = null
  private token: string | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private state: TenureEngineState = {
    status: 'stopped',
    url: null,
    program: null,
    detail: null,
    limits: null
  }
  private readonly listeners = new Set<(state: TenureEngineState) => void>()

  /** The engine's island page with its token, or null until the engine is ready. */
  islandUrl(): string | null {
    return this.origin && this.token
      ? `${this.origin}/?t=${encodeURIComponent(this.token)}#/island`
      : null
  }

  getState(): TenureEngineState {
    return this.state
  }

  onChange(listener: (state: TenureEngineState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.child) {
      return
    }
    const program = resolveTenureEngineProgram()
    if (!program) {
      this.set({
        status: 'failed',
        program: null,
        detail: `tenure 엔진을 찾지 못했습니다. ${TENURE_ENGINE_ENV} 에 실행 파일 경로를 넣으세요.`
      })
      return
    }
    this.set({ status: 'starting', program, detail: null, url: null })
    const child = spawnProcess({
      program,
      args: tenureEngineArgs(process.pid),
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      detached: process.platform !== 'win32'
    })
    this.child = child
    let buffer = ''
    let stderrTail = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    // Why: an unhandled stream error crashes main; exits are reported on close.
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      stream.on('error', () => {})
    }
    child.stderr.on('data', (text: string) => {
      stderrTail = (stderrTail + text).slice(-STDERR_TAIL_CHARS)
    })
    const readyTimer = setTimeout(() => {
      if (this.state.status === 'starting') {
        this.set({ status: 'failed', detail: '엔진이 제때 준비되지 않았습니다.' })
        this.stop()
      }
    }, READY_TIMEOUT_MS)
    child.stdout.on('data', (text: string) => {
      buffer += text
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line.startsWith(READY_PREFIX)) {
          clearTimeout(readyTimer)
          this.onReady(line.slice(READY_PREFIX.length))
        }
        newline = buffer.indexOf('\n')
      }
    })
    child.once('error', (error) => {
      clearTimeout(readyTimer)
      this.set({ status: 'failed', detail: error.message })
    })
    child.once('close', (code) => {
      clearTimeout(readyTimer)
      this.child = null
      this.origin = null
      this.token = null
      this.stopPolling()
      if (this.state.status !== 'stopped') {
        const tail = stderrTail.trim().split('\n').slice(-3).join(' ')
        this.set({
          status: 'failed',
          url: null,
          detail: tail || `엔진이 끝났습니다 (종료 코드 ${code}).`
        })
      }
    })
  }

  stop(): void {
    this.stopPolling()
    const child = this.child
    this.child = null
    this.set({ status: 'stopped', url: null })
    if (child) {
      void forceTerminateProcessTree(child)
    }
  }

  restart(): void {
    this.stop()
    this.start()
  }

  async request(req: TenureEngineRequest): Promise<TenureEngineResponse> {
    if (!this.origin || !this.token) {
      return { ok: false, status: 0, data: null, error: '엔진이 준비되지 않았습니다.' }
    }
    // Why: the renderer only reaches the engine API, never the UI pages or other origins.
    if (!/^\/api\/[a-z0-9/_-]+$/i.test(req.path)) {
      return { ok: false, status: 400, data: null, error: '잘못된 엔진 경로입니다.' }
    }
    const url = new URL(req.path, this.origin)
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
    const headers: Record<string, string> = { 'X-Tenure-Token': this.token }
    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    }
    if (req.body !== undefined && req.method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(req.body)
    }
    try {
      const res = await fetch(url, init)
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      const error = res.ok
        ? null
        : typeof data === 'object' && data && 'error' in data
          ? String(data.error)
          : `HTTP ${res.status}`
      return { ok: res.ok, status: res.status, data, error }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private onReady(payload: string): void {
    try {
      const parsed: unknown = JSON.parse(payload)
      const raw = typeof parsed === 'object' && parsed && 'url' in parsed ? String(parsed.url) : ''
      const url = new URL(raw)
      this.token = url.searchParams.get('t')
      this.origin = url.origin
      this.set({ status: 'ready', url: url.origin, detail: null })
      void this.refreshLimits()
      this.pollTimer = setInterval(() => void this.refreshLimits(), LIMITS_POLL_MS)
      this.pollTimer.unref?.()
    } catch {
      this.set({ status: 'failed', detail: '엔진 준비 신호를 읽지 못했습니다.' })
    }
  }

  private async refreshLimits(): Promise<void> {
    const res = await this.request({ method: 'GET', path: '/api/limits' })
    if (res.ok) {
      this.set({ limits: parseTenureLimits(res.data) })
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private set(patch: Partial<TenureEngineState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
