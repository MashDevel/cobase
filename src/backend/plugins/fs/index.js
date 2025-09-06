import { ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { create_patch, question, blank } from '../../prompts.js'
import { Tiktoken } from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

const TOKEN_ESTIMATE_THRESHOLD = 64 * 1024
const LINES_SAMPLE_THRESHOLD = 64 * 1024

async function estimateOrReadTokens(encoder, fullPath) {
  try {
    const stat = await fs.stat(fullPath)
    if (stat.size <= TOKEN_ESTIMATE_THRESHOLD) {
      const content = await fs.readFile(fullPath, 'utf8')
      try {
        return encoder.encode(content).length
      } catch (_) {
        return Math.ceil(Buffer.byteLength(content, 'utf8') / 4)
      }
    }
    return Math.ceil(stat.size / 4)
  } catch {
    return 0
  }
}

async function estimateOrReadLines(fullPath) {
  try {
    const stat = await fs.stat(fullPath)
    if (stat.size <= LINES_SAMPLE_THRESHOLD) {
      const content = await fs.readFile(fullPath, 'utf8')
      if (!content) return 0
      let count = 0
      for (let i = 0; i < content.length; i++) if (content[i] === '\n') count++
      if (content.length > 0 && content[content.length - 1] !== '\n') count++
      return count
    }
    const fh = await fs.open(fullPath, 'r')
    try {
      const buf = Buffer.alloc(LINES_SAMPLE_THRESHOLD)
      const { bytesRead } = await fh.read(buf, 0, LINES_SAMPLE_THRESHOLD, 0)
      if (!bytesRead) return 0
      let nl = 0
      for (let i = 0; i < bytesRead; i++) if (buf[i] === 10) nl++
      const density = nl / bytesRead
      const est = Math.ceil(density * stat.size)
      return est > 0 ? est : stat.size > 0 ? 1 : 0
    } finally {
      await fh.close()
    }
  } catch {
    return 0
  }
}

async function filesPayloadFromPaths(encoder, allPaths) {
  return Promise.all(
    allPaths.map(async fullPath => {
      try {
        const [tokens, lines] = await Promise.all([
          estimateOrReadTokens(encoder, fullPath),
          estimateOrReadLines(fullPath),
        ])
        return { fullPath, name: path.basename(fullPath), tokens, lines }
      } catch {
        return { fullPath, name: path.basename(fullPath), tokens: 0, lines: 0 }
      }
    })
  )
}

export function registerFs(ctx) {
  const encoder = ctx.encoder || new Tiktoken(o200k_base)

  ipcMain.handle('file:readTokens', async (_event, filePath) => {
    try {
      let content = await fs.readFile(filePath, 'utf-8')
      try {
        return encoder.encode(content).length
      } catch {
        return Math.ceil(Buffer.byteLength(content, 'utf8') / 4)
      }
    } catch {
      return 0
    }
  })

  ipcMain.handle('file:estimateTokens', async (_event, filePath) => {
    return estimateOrReadTokens(encoder, filePath)
  })

  ipcMain.handle('file:estimateLines', async (_event, filePath) => {
    return estimateOrReadLines(filePath)
  })

  ipcMain.handle('dialog:openFolderDirect', async (_event, folderPath) => {
    try {
      const allPaths = await ctx.folderWatcher.listFiles(folderPath)
      const win = ctx.getMainWindow()
      if (win) win.setTitle(`${path.basename(folderPath)} - Cobase`)
      const files = await filesPayloadFromPaths(encoder, allPaths)
      if (win) win.webContents.send('files:initial', files)
      ctx.setOpenedFolderPath(folderPath)
      ctx.folderWatcher.start(folderPath, {
        onAdd: p => {
          const w = ctx.getMainWindow()
          if (w) w.webContents.send('file-added', p)
        },
        onChange: p => {
          const w = ctx.getMainWindow()
          if (w) w.webContents.send('file-changed', p)
        },
        onUnlink: p => {
          const w = ctx.getMainWindow()
          if (w) w.webContents.send('file-removed', p)
        },
      })
      return folderPath
    } catch {
      return null
    }
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled) return null
    const folderPath = result.filePaths[0]
    const win = ctx.getMainWindow()
    if (win) win.setTitle(`${path.basename(folderPath)} - Cobase`)
    const allPaths = await ctx.folderWatcher.listFiles(folderPath)
    const files = await filesPayloadFromPaths(encoder, allPaths)
    if (win) win.webContents.send('files:initial', files)
    ctx.setOpenedFolderPath(folderPath)
    ctx.folderWatcher.start(folderPath, {
      onAdd: p => {
        const w = ctx.getMainWindow()
        if (w) w.webContents.send('file-added', p)
      },
      onChange: p => {
        const w = ctx.getMainWindow()
        if (w) w.webContents.send('file-changed', p)
      },
      onUnlink: p => {
        const w = ctx.getMainWindow()
        if (w) w.webContents.send('file-removed', p)
      },
    })
    return folderPath
  })

  ipcMain.handle('file:copySelected', async (_event, filePaths, includeTree, promptType, instructions) => {
    try {
      const baseDir = ctx.getOpenedFolderPath()
      if (!baseDir) throw new Error('No folder is currently opened.')
      let treeHeader = ''
      if (includeTree) {
        const tree = {}
        for (const fullPath of filePaths) {
          const relativePath = path.relative(baseDir, fullPath)
          const parts = relativePath.split(path.sep)
          let node = tree
          for (const part of parts) {
            if (!node[part]) node[part] = {}
            node = node[part]
          }
        }
        const lines = []
        const walk = (node, prefix = '') => {
          const names = Object.keys(node).sort()
          names.forEach((name, i) => {
            const isLast = i === names.length - 1
            lines.push(`${prefix}${isLast ? '└─ ' : '├─ '}${name}`)
            walk(node[name], prefix + (isLast ? '   ' : '│  '))
          })
        }
        walk(tree)
        treeHeader = '# File Tree\n' + lines.join('\n') + '\n\n'
      }
      const contents = await Promise.all(
        filePaths.map(async filePath => {
          const relativePath = path.relative(baseDir, filePath)
          let content = await fs.readFile(filePath, 'utf8')
          return `# ./${relativePath}\n${content}`
        })
      )
      let guidelines = ''
      switch (promptType) {
        case 'Patch':
          guidelines = create_patch
          break
        case 'Question':
          guidelines = question
          break
        case 'Blank':
          guidelines = blank
          break
        default:
          guidelines = ''
      }
      let parts = [treeHeader, contents.join('\n\n')]
      if (guidelines && guidelines.trim()) parts.push(`\nGuidelines:\n${guidelines.trim()}`)
      if (instructions && instructions.trim()) parts.push(`\nInstructions:\n${instructions.trim()}`)
      const finalText = parts.join('')
      const { clipboard } = await import('electron')
      clipboard.writeText(finalText)
      return true
    } catch {
      return false
    }
  })
}

