import { ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function registerSearch(ctx) {
  ipcMain.handle('search:run', async (_e, payload) => {
    try {
      const baseDir = ctx.getOpenedFolderPath()
      if (!baseDir) return { success: false, error: 'No folder is currently opened' }
      const q = (payload?.query || '').toString()
      const regex = !!payload?.regex
      const caseSensitive = !!payload?.caseSensitive
      const word = !!payload?.word
      const perFile = Number.isFinite(payload?.perFile) ? Math.max(1, Math.min(1000, payload.perFile)) : 3
      const maxTotal = Number.isFinite(payload?.maxResults) ? Math.max(1, Math.min(10000, payload.maxResults)) : 500
      if (!q) return { success: true, data: [] }
      let re
      try {
        if (regex) re = new RegExp(q, 'g' + (caseSensitive ? '' : 'i'))
        else {
          const pattern = word ? `\\b${escapeRegExp(q)}\\b` : escapeRegExp(q)
          re = new RegExp(pattern, 'g' + (caseSensitive ? '' : 'i'))
        }
      } catch (err) {
        return { success: false, error: 'Invalid regular expression' }
      }
      const filePaths = await ctx.folderWatcher.listFiles(baseDir)
      const results = []
      for (const fullPath of filePaths) {
        if (results.length >= maxTotal) break
        let text = ''
        try {
          text = await fs.readFile(fullPath, 'utf8')
        } catch {
          continue
        }
        const lines = text.split('\n')
        let added = 0
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxTotal) break
          const line = lines[i]
          re.lastIndex = 0
          const matches = []
          let m
          while ((m = re.exec(line)) && matches.length < 100) {
            const start = m.index
            const end = m.index + (m[0]?.length || 0)
            if (end > start) matches.push([start, end])
            if (m[0]?.length === 0) re.lastIndex = re.lastIndex + 1
          }
          if (matches.length) {
            results.push({
              path: path.relative(baseDir, fullPath),
              line: i + 1,
              preview: line,
              ranges: matches,
            })
            added++
            if (added >= perFile) break
          }
        }
      }
      return { success: true, data: results }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })
}

