import { app, BrowserWindow, ipcMain, dialog, globalShortcut, clipboard, Menu } from 'electron';
import { create_patch, question, blank } from './prompts.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { FolderWatcher } from './watcher.js';
import fs from 'fs/promises';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { process_patch, DiffError } from './applyPatch.js';

import { Tiktoken } from "js-tiktoken/lite";
import o200k_base from "js-tiktoken/ranks/o200k_base";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const folderWatcher = new FolderWatcher();
let mainWindow = null;
let openedFolderPath = null;

const encoder = new Tiktoken(o200k_base);

function createWindow() {
  if (process.platform === 'darwin') {
    const dockMenu = Menu.buildFromTemplate([
      {
        label: 'New Window',
        click: () => { createWindow() }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        role: 'quit'
      }
    ])
  
    app.dock.setMenu(dockMenu)
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 10, y: 10 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    globalShortcut.register('F12', () => {
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
  } else {
    mainWindow.loadURL(`file://${path.resolve(__dirname, '../../dist/index.html')}`);
  }
}

app.whenReady().then(createWindow);

const stripContent = (content) => {
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  content = content.replace(/("""|''')[\s\S]*?\1/g, '');
  content = content.replace(/^\s*(\/\/|#).*$/gm, '');
  content = content.replace(/^\s*[\r\n]/gm, '');
  return content;
};

ipcMain.handle('file:readTokens', async (_event, filePath) => {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    // content = stripContent(content);
    const tokens = encoder.encode(content);
    return tokens.length;
  } catch (err) {
    console.error(`Failed to read tokens from ${filePath}:`, err);
    return 0;
  }
});

ipcMain.handle('dialog:openFolderDirect', async (_event, folderPath) => {
  const allPaths = await folderWatcher.listFiles(folderPath);
  mainWindow.setTitle(`${path.basename(folderPath)} - Cobase`);
  const files = await Promise.all(
    allPaths.map(async (fullPath) => ({
      fullPath,
      name: path.basename(fullPath),
      tokens: await fs.readFile(fullPath, 'utf8').then(s => s.split(/\s+/).length),
    }))
  );
  mainWindow.webContents.send('files:initial', files);
  openedFolderPath = folderPath;
  folderWatcher.start(folderPath, {
    onAdd:    p => mainWindow.webContents.send('file-added',   p),
    onChange: p => mainWindow.webContents.send('file-changed', p),
    onUnlink: p => mainWindow.webContents.send('file-removed', p),
  });
  return folderPath;
});

// ------------------------------------------------------------------
// ApplyPatch: actually process and apply a patch using codex-cli logic
// ------------------------------------------------------------------
ipcMain.handle('applyPatch', async (_event, patchText) => {
  try {
    if (!openedFolderPath) throw new Error("No folder is currently opened");

    const resolvePath = (p) => path.resolve(openedFolderPath, p);

    const result = process_patch(
      patchText,
      p => readFileSync(resolvePath(p), 'utf8'),
      (p, content) => writeFileSync(resolvePath(p), content, 'utf8'),
      p => unlinkSync(resolvePath(p)),
    );

    return { success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
});

ipcMain.handle('file:copySelected', async (_event, filePaths, includeTree, promptType, instructions) => {
  try {
    const baseDir = openedFolderPath;
    if (!baseDir) throw new Error('No folder is currently opened.');
    let treeHeader = '';
    if (includeTree) {
      const tree = {};
      for (const fullPath of filePaths) {
        const relativePath = path.relative(baseDir, fullPath);
        const parts = relativePath.split(path.sep);
        let node = tree;
        for (const part of parts) {
          if (!node[part]) node[part] = {};
          node = node[part];
        }
      }
      const lines = [];
      const walk = (node, prefix = '') => {
        const names = Object.keys(node).sort();
        names.forEach((name, i) => {
          const isLast = i === names.length - 1;
          lines.push(
            `${prefix}${isLast ? '└─ ' : '├─ '}${name}`
          );
          walk(node[name], prefix + (isLast ? '   ' : '│  '));
        });
      };
      walk(tree);
      treeHeader = '# File Tree\n' + lines.join('\n') + '\n\n';
    }
    const contents = await Promise.all(
      filePaths.map(async filePath => {
        const relativePath = path.relative(baseDir, filePath);
        let content = await fs.readFile(filePath, 'utf8');
        // content = stripContent(content);
        return `# ./${relativePath}\n${content}`;
      })
    );
    // pick the correct template based on UI selection
    let guidelines = '';
    switch (promptType) {
      case 'Patch':
        guidelines = create_patch;
        break;
      case 'Question':
        guidelines = question;
        break;
      case 'Blank':
        guidelines = blank;
        break;
      default:
        guidelines = '';
    }
    let parts = [
      treeHeader,
      contents.join('\n\n')
    ];
    if (guidelines && guidelines.trim()) {
      parts.push(`\nGuidelines:\n${guidelines.trim()}`);
    }
    if (instructions && instructions.trim()) {
      parts.push(`\nInstructions:\n${instructions.trim()}`);
    }
    const finalText = parts.join('');
    clipboard.writeText(finalText)
    return true;
  } catch (err) {
    console.error('Failed to copy files:', err);
    return false;
  }
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  const folderPath = result.filePaths[0];
  mainWindow.setTitle(`${path.basename(folderPath)} - Cobase`);
  const allPaths = await folderWatcher.listFiles(folderPath);
  const files = await Promise.all(
    allPaths.map(async (fullPath) => ({
      fullPath,
      name: path.basename(fullPath),
      tokens: await fs.readFile(fullPath, 'utf8').then(s => s.split(/\s+/).length),
    }))
  );
  mainWindow.webContents.send('files:initial', files);
  openedFolderPath = folderPath;
  folderWatcher.start(folderPath, {
    onAdd:    p => mainWindow.webContents.send('file-added',   p),
    onChange: p => mainWindow.webContents.send('file-changed', p),
    onUnlink: p => mainWindow.webContents.send('file-removed', p),
  });
  return folderPath;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
