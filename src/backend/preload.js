const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  onFilesInitial: cb  => ipcRenderer.on('files:initial', (_evt, files) => cb(files)),
  onFileAdded:     cb  => ipcRenderer.on('file-added',     (_evt, p) => cb(p)),
  onFileChanged:   cb  => ipcRenderer.on('file-changed',   (_evt, p) => cb(p)),
  onFileRemoved:   cb  => ipcRenderer.on('file-removed',   (_evt, p) => cb(p)),
  readTokens:      p   => ipcRenderer.invoke('file:readTokens', p),
  estimateTokens:  p   => ipcRenderer.invoke('file:estimateTokens', p),
  estimateLines:   p   => ipcRenderer.invoke('file:estimateLines', p),
  copySelectedFiles: (paths, includeTree, promptType, instructions) =>
    ipcRenderer.invoke('file:copySelected', paths, includeTree, promptType, instructions),
  copyGitDiff: () => ipcRenderer.invoke('git:copyDiff'),
  openFolderDirect: (path) => ipcRenderer.invoke('dialog:openFolderDirect', path),
  applyPatch: (patch) => ipcRenderer.invoke('applyPatch', patch),
});
