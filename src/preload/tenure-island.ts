import { contextBridge, ipcRenderer } from 'electron'

// Why this shape: the island page is tenure engine's own `#/island` view, which talks to its shell
// through `window.__TAURI_INTERNALS__.invoke(cmd, args)`; only island_mode and open_main are honored.
contextBridge.exposeInMainWorld('__TAURI_INTERNALS__', {
  invoke: (cmd: string, args?: unknown): Promise<unknown> =>
    ipcRenderer.invoke('tenureIsland:invoke', cmd, args)
})
