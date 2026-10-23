import { ipcRenderer } from 'electron'
import type {
  TenureEngineRequest,
  TenureEngineResponse,
  TenureEngineState
} from '../../shared/tenure-engine-types'
import type { PreloadApi } from '../api-types'

export const tenureEngineApi = {
  get: (): Promise<TenureEngineState> => ipcRenderer.invoke('tenureEngine:get'),
  restart: (): Promise<TenureEngineState> => ipcRenderer.invoke('tenureEngine:restart'),
  request: (req: TenureEngineRequest): Promise<TenureEngineResponse> =>
    ipcRenderer.invoke('tenureEngine:request', req),
  onUpdate: (callback: (state: TenureEngineState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: TenureEngineState) =>
      callback(state)
    ipcRenderer.on('tenureEngine:update', listener)
    return () => ipcRenderer.removeListener('tenureEngine:update', listener)
  },
  onReveal: (callback: (target: { hash: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, target: { hash: string }) =>
      callback(target)
    ipcRenderer.on('tenureEngine:reveal', listener)
    return () => ipcRenderer.removeListener('tenureEngine:reveal', listener)
  }
} satisfies PreloadApi['tenureEngine']
