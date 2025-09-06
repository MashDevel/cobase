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
    status: async () => {
      const res = await ipcRenderer.invoke('git:status')
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'STATUS_FAILED', message: res?.error || 'Unknown error' } }
    },
    diffFile: async (path, staged) => {
      const res = await ipcRenderer.invoke('git:diffFile', { path, staged })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'DIFF_FAILED', message: res?.error || 'Unknown error' } }
    },
    stage: async (paths) => {
      const res = await ipcRenderer.invoke('git:stage', paths)
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'STAGE_FAILED', message: res?.error || 'Unknown error' } }
    },
    unstage: async (paths) => {
      const res = await ipcRenderer.invoke('git:unstage', paths)
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'UNSTAGE_FAILED', message: res?.error || 'Unknown error' } }
    },
    discard: async (paths) => {
      const res = await ipcRenderer.invoke('git:discard', paths)
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'DISCARD_FAILED', message: res?.error || 'Unknown error' } }
    },
    commit: async (message) => {
      const res = await ipcRenderer.invoke('git:commit', { message })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'COMMIT_FAILED', message: res?.error || 'Unknown error' } }
    },
    log: async (params) => {
      const res = await ipcRenderer.invoke('git:log', params)
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'LOG_FAILED', message: res?.error || 'Unknown error' } }
    },
    commitDetails: async (sha) => {
      const res = await ipcRenderer.invoke('git:commitDetails', sha)
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'COMMIT_DETAILS_FAILED', message: res?.error || 'Unknown error' } }
    },
    blame: async (path, rev) => {
      const res = await ipcRenderer.invoke('git:blame', { path, rev })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'BLAME_FAILED', message: res?.error || 'Unknown error' } }
    },
    branches: async () => {
      const res = await ipcRenderer.invoke('git:branches')
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'BRANCHES_FAILED', message: res?.error || 'Unknown error' } }
    },
    branchCreate: async (name, checkout) => {
      const res = await ipcRenderer.invoke('git:branchCreate', { name, checkout })
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'BRANCH_CREATE_FAILED', message: res?.error || 'Unknown error' } }
    },
    switch: async (name, force) => {
      const res = await ipcRenderer.invoke('git:switch', { name, force })
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: res?.code || 'SWITCH_FAILED', message: res?.error || 'Unknown error' } }
    },
    copyCommitPatch: async (sha) => {
      const res = await ipcRenderer.invoke('git:copyCommitPatch', sha)
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'COPY_COMMIT_PATCH_FAILED', message: res?.error || 'Unknown error' } }
    },
    copyRangePrompt: async (from, to, tokenBudget) => {
      const res = await ipcRenderer.invoke('git:copyRangePrompt', { from, to, tokenBudget })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'COPY_RANGE_PROMPT_FAILED', message: res?.error || 'Unknown error' } }
    },
    showPatch: async (sha, path) => {
      const res = await ipcRenderer.invoke('git:showPatch', { sha, path })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'SHOW_PATCH_FAILED', message: res?.error || 'Unknown error' } }
    },
  },
  patch: {
    apply: async (patchText) => {
      const res = await ipcRenderer.invoke('applyPatch', patchText)
      if (res?.success) return { ok: true, data: true }
      return { ok: false, error: { code: 'PATCH_FAILED', message: res?.error || 'Unknown error' } }
    },
  },
  search: {
    run: async (query, options) => {
      const res = await ipcRenderer.invoke('search:run', { query, ...(options || {}) })
      if (res?.success) return { ok: true, data: res.data }
      return { ok: false, error: { code: 'SEARCH_FAILED', message: res?.error || 'Unknown error' } }
    },
  },
})
