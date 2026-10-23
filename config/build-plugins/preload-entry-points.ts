import { resolve } from 'node:path'

// Why a second entry: the tenure island window gets a two-command bridge, not window.api.
export const PRELOAD_ENTRY_POINTS = {
  index: resolve('src/preload/index.ts'),
  'tenure-island': resolve('src/preload/tenure-island.ts')
}
