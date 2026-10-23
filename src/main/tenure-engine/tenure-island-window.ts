import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import type { TenureEngineService } from './tenure-engine-service'

// The island: a small always-on-top window at the top centre showing what needs you (DESIGN.md 36.21, 36.23 M40).
const SIZES: Record<string, [number, number]> = {
  pill: [380, 40],
  banner: [460, 84],
  panel: [460, 560]
}
// Why the order: Ctrl+Alt+Space is commonly taken (e.g. by the Claude app); first free key wins.
const SHORTCUTS = ['CommandOrControl+Alt+T', 'CommandOrControl+Shift+Space']

let island: BrowserWindow | null = null
let loadedUrl: string | null = null

function place(win: BrowserWindow, mode: string): void {
  const [width, height] = SIZES[mode] ?? SIZES.pill
  const area = screen.getPrimaryDisplay().workArea
  win.setBounds({
    x: Math.round(area.x + (area.width - width) / 2),
    y: area.y + 6,
    width,
    height
  })
}

function mainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows().find((win) => win !== island && !win.isDestroyed()) ?? null
}

function openMain(hash: unknown): void {
  const win = mainWindow()
  if (!win) {
    return
  }
  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  win.focus()
  win.webContents.send('tenureEngine:reveal', { hash: typeof hash === 'string' ? hash : '' })
}

function ensureIsland(url: string): void {
  if (island && !island.isDestroyed()) {
    if (loadedUrl !== url) {
      loadedUrl = url
      void island.loadURL(url)
    }
    return
  }
  const win = new BrowserWindow({
    width: SIZES.pill[0],
    height: SIZES.pill[1],
    title: 'tenure 섬',
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/tenure-island.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(true, 'floating')
  // Why: the island only ever shows the engine's own page; links never open inside it.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(new URL(url).origin)) {
      event.preventDefault()
    }
  })
  win.once('ready-to-show', () => {
    place(win, 'pill')
    win.showInactive()
  })
  win.on('closed', () => {
    island = null
    loadedUrl = null
  })
  island = win
  loadedUrl = url
  void win.loadURL(url)
}

/** Opens the island once the engine is ready and follows engine restarts; Ctrl+Alt+T toggles its panel. */
export function startTenureIsland(engine: TenureEngineService): void {
  ipcMain.handle('tenureIsland:invoke', (event, cmd: unknown, args: unknown) => {
    if (!island || event.sender !== island.webContents) {
      return null
    }
    const params = typeof args === 'object' && args !== null ? args : {}
    if (cmd === 'island_mode') {
      const mode = 'mode' in params ? String(params.mode) : 'pill'
      if (mode === 'hide') {
        island.hide()
        return null
      }
      place(island, mode)
      if (mode === 'panel') {
        island.show()
        island.focus()
      } else {
        island.showInactive()
      }
    } else if (cmd === 'open_main') {
      openMain('hash' in params ? params.hash : '')
    }
    return null
  })
  const sync = (): void => {
    const url = engine.islandUrl()
    if (url) {
      ensureIsland(url)
    }
  }
  engine.onChange(sync)
  sync()
  for (const key of SHORTCUTS) {
    const ok = globalShortcut.register(key, () => {
      if (island && !island.isDestroyed()) {
        island.showInactive()
        void island.webContents.executeJavaScript('window.islandToggle && window.islandToggle()')
      }
    })
    if (ok) {
      break
    }
  }
  app.once('will-quit', () => {
    globalShortcut.unregisterAll()
    if (island && !island.isDestroyed()) {
      island.destroy()
    }
  })
}
