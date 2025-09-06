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

contextBridge.exposeInMainWorld('api', {
  fs: {
    selectFolder: async () => {
      const picked = await ipcRenderer.invoke('dialog:openFolder')
      return { ok: true, data: picked ?? undefined }
    },
    openFolderDirect: async (path) => {
      const res = await ipcRenderer.invoke('dialog:openFolderDirect', path)
      if (res) return { ok: true, data: res }
      return { ok: false, error: { code: 'OPEN_FAILED', message: 'Failed to open folder' } }
    },
    estimateTokens: async (p) => {
      const n = await ipcRenderer.invoke('file:estimateTokens', p)
      return { ok: true, data: typeof n === 'number' ? n : 0 }
    },
    estimateLines: async (p) => {
      const n = await ipcRenderer.invoke('file:estimateLines', p)
      return { ok: true, data: typeof n === 'number' ? n : 0 }
    },
    onFilesInitial: (cb) => ipcRenderer.on('files:initial', (_evt, files) => cb(files)),
    onFileAdded:   (cb) => ipcRenderer.on('file-added',   (_evt, p) => cb(p)),
    onFileChanged: (cb) => ipcRenderer.on('file-changed', (_evt, p) => cb(p)),
    onFileRemoved: (cb) => ipcRenderer.on('file-removed', (_evt, p) => cb(p)),
    copySelectedFiles: async (paths, includeTree, promptType, instructions) => {
      const ok = await ipcRenderer.invoke('file:copySelected', paths, includeTree, promptType, instructions)
      if (ok) return { ok: true, data: true }
      return { ok: false, error: { code: 'COPY_SELECTED_FAILED', message: 'Failed to copy selected files' } }
    },
  },
  git: {
    copyDiff: async () => {
      const res = await ipcRenderer.invoke('git:copyDiff')
      if (res?.success) return { ok: true, data: { diffLength: res.diffLength || 0 } }
      return { ok: false, error: { code: 'COPY_DIFF_FAILED', message: res?.error || 'Unknown error' } }
    },
  },
  patch: {
    apply: async (patchText) => {
      const res = await ipcRenderer.invoke('applyPatch', patchText)
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'PATCH_FAILED', message: res?.error || 'Unknown error' } }
    },
  },
})
