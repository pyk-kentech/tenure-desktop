import type {
  TenureEngineRequest,
  TenureEngineResponse,
  TenureEngineState
} from '../../shared/tenure-engine-types'

export type TenureEngineApi = {
  get: () => Promise<TenureEngineState>
  restart: () => Promise<TenureEngineState>
  request: (req: TenureEngineRequest) => Promise<TenureEngineResponse>
  onUpdate: (callback: (state: TenureEngineState) => void) => () => void
  onReveal: (callback: (target: { hash: string }) => void) => () => void
}
