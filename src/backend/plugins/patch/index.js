import { ipcMain } from 'electron'
import path from 'path'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { process_patch } from './applyPatch.js'

export function registerPatch(ctx) {
  ipcMain.handle('applyPatch', async (_event, patchText) => {
    try {
      const base = ctx.getOpenedFolderPath()
      if (!base) throw new Error('No folder is currently opened')
      const resolvePath = p => path.resolve(base, p)
      const result = process_patch(
        patchText,
        p => readFileSync(resolvePath(p), 'utf8'),
        (p, content) => writeFileSync(resolvePath(p), content, 'utf8'),
        p => unlinkSync(resolvePath(p))
      )
      return { success: true, result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })
}
