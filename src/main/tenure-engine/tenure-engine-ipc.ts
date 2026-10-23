import { app, BrowserWindow, ipcMain } from 'electron'
import type { TenureEngineRequest } from '../../shared/tenure-engine-types'
import { TenureEngineService } from './tenure-engine-service'
import { startTenureIsland } from './tenure-island-window'

let service: TenureEngineService | null = null

/** Starts the engine once per app run, exposes it over IPC, and stops it when the app quits. */
export function startTenureEngine(): TenureEngineService {
  if (service) {
    return service
  }
  const engine = new TenureEngineService()
  service = engine
  ipcMain.handle('tenureEngine:get', () => engine.getState())
  ipcMain.handle('tenureEngine:restart', () => {
    engine.restart()
    return engine.getState()
  })
  ipcMain.handle('tenureEngine:request', (_event, req: TenureEngineRequest) => engine.request(req))
  engine.onChange((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('tenureEngine:update', state)
      }
    }
  })
  // Why will-quit: before-quit can still be vetoed by the renderer, and the engine must outlive a veto.
  app.once('will-quit', () => engine.stop())
  engine.start()
  startTenureIsland(engine)
  return engine
}
