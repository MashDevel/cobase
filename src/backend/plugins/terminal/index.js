import { ipcMain } from 'electron'
import os from 'os'
import pty from 'node-pty'

const terminals = new Map()
let nextId = 1

function getDefaultShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe'
  return process.env.SHELL || '/bin/bash'
}

export function registerTerminal(ctx) {
  const win = ctx.getMainWindow()
  const wc = win?.webContents
  if (wc) {
    wc.on('destroyed', () => {
      for (const [, t] of terminals) t.kill()
      terminals.clear()
    })
  }
  ipcMain.handle('terminal:create', async () => {
    try {
      const id = String(nextId++)
      const shell = getDefaultShell()
      const cwd = ctx.getOpenedFolderPath() || process.env.HOME || os.homedir() || process.cwd()
      const env = { ...process.env }
      env.TERM = env.TERM || 'xterm-256color'
      const proc = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd,
        env,
      })
      terminals.set(id, proc)
      proc.onData(data => {
        if (win && !win.isDestroyed()) win.webContents.send('terminal:data', { id, data })
      })
      proc.onExit(({ exitCode, signal }) => {
        if (win && !win.isDestroyed()) win.webContents.send('terminal:exit', { id, exitCode, signal })
        terminals.delete(id)
      })
      return { success: true, data: { id } }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('terminal:write', async (_e, { id, data }) => {
    try {
      const term = terminals.get(String(id))
      if (!term) return { success: false, error: 'Terminal not found' }
      term.write(data || '')
      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('terminal:resize', async (_e, { id, cols, rows }) => {
    try {
      const term = terminals.get(String(id))
      if (!term) return { success: false, error: 'Terminal not found' }
      const c = Number.isFinite(cols) ? Math.max(1, cols) : 80
      const r = Number.isFinite(rows) ? Math.max(1, rows) : 24
      term.resize(c, r)
      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('terminal:kill', async (_e, { id }) => {
    try {
      const term = terminals.get(String(id))
      if (!term) return { success: false, error: 'Terminal not found' }
      term.kill()
      terminals.delete(String(id))
      return { success: true, data: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })
}
