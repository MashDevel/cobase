import { app, BrowserWindow, globalShortcut, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { FolderWatcher } from './watcher.js'
import { Tiktoken } from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'
import { registerFs } from './plugins/fs/index.js'
import { registerGit } from './plugins/git/index.js'
import { registerPatch } from './plugins/patch/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const folderWatcher = new FolderWatcher()
let mainWindow = null
let openedFolderPath = null
const encoder = new Tiktoken(o200k_base)

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow()
          },
        },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  if (process.platform === 'darwin') {
    const dockMenu = Menu.buildFromTemplate([
      { label: 'New Window', click: () => { createWindow() } },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ])
    app.dock.setMenu(dockMenu)
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 58, y: 10 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    globalShortcut.register('F12', () => {
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' })
        }
      }
    })
  } else {
    mainWindow.loadURL(`file://${path.resolve(__dirname, '../../dist/index.html')}`)
  }
}

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  const ctx = {
    getMainWindow: () => mainWindow,
    getOpenedFolderPath: () => openedFolderPath,
    setOpenedFolderPath: v => { openedFolderPath = v },
    folderWatcher,
    encoder,
  }
  registerFs(ctx)
  registerGit(ctx)
  registerPatch(ctx)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

