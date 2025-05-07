const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  onFilesInitial: cb  => ipcRenderer.on('files:initial', (_evt, files) => cb(files)),
  onFileAdded:     cb  => ipcRenderer.on('file-added',     (_evt, p) => cb(p)),
  onFileChanged:   cb  => ipcRenderer.on('file-changed',   (_evt, p) => cb(p)),
  onFileRemoved:   cb  => ipcRenderer.on('file-removed',   (_evt, p) => cb(p)),
  readTokens:      p   => ipcRenderer.invoke('file:readTokens', p),
  copySelectedFiles: (paths, includeTree, promptType, instructions) =>
    ipcRenderer.invoke('file:copySelected', paths, includeTree, promptType, instructions),
  openFolderDirect: (path) => ipcRenderer.invoke('dialog:openFolderDirect', path),
  applyPatch: (patch) => ipcRenderer.invoke('applyPatch', patch),
});
