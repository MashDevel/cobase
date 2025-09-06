import { create } from 'zustand'
import { buildAsciiTree } from './services/tree'

const uuidv4 = () => crypto.randomUUID()

export type FileEntry = {
  id: string
  name: string
  fullPath: string
  tokens: number
  lines: number
}

export type ExplorerState = {
  files: FileEntry[]
  selected: Set<string>
  search: string
  folderPath: string | null
  initialized: boolean
  handleInitialFiles: (list: { fullPath: string; name: string; tokens?: number; lines?: number }[]) => Promise<void>
  handleFileAdded: (fullPath: string) => Promise<void>
  handleFileChanged: (fullPath: string) => Promise<void>
  handleFileRemoved: (fullPath: string) => void
  toggleSelected: (id: string) => void
  selectAll: () => void
  clearAll: () => void
  setSearch: (search: string) => void
  setFolderPath: (path: string | null) => void
  initFromLastFolder: () => Promise<void>
  selectFolder: () => Promise<void>
  copyGitDiff: () => Promise<{ ok: boolean; data?: { diffLength: number }; error?: { code: string; message: string } }>
  copyFileTree: () => Promise<{ success: boolean; error?: string }>
  copySelectedFiles: (includeTree: boolean, promptType: string, instructions: string) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
}

const useExplorerStore = create<ExplorerState>((set, get) => ({
  files: [],
  selected: new Set(),
  search: '',
  folderPath: null,
  initialized: false,
  handleInitialFiles: async (list) => {
    const files: FileEntry[] = list.map((f) => ({
      id: uuidv4(),
      name: f.name,
      fullPath: f.fullPath,
      tokens: typeof f.tokens === 'number' ? f.tokens : 0,
      lines: typeof f.lines === 'number' ? f.lines : 0,
    }))
    set({ files })
    const missing = files.filter(f => f.lines === 0)
    if (missing.length) {
      await Promise.all(
        missing.map(async (file) => {
          const res = await window.api.fs.estimateLines(file.fullPath)
          const lines = typeof res.data === 'number' ? res.data : 0
          set((state) => ({
            files: state.files.map((f) => (f.id === file.id ? { ...f, lines } : f)),
          }))
        })
      )
    }
  },
  handleFileAdded: async (fullPath) => {
    const name = fullPath.split(/[\\\/]/).pop()!
    const [tokRes, lineRes] = await Promise.all([
      window.api.fs.estimateTokens(fullPath),
      window.api.fs.estimateLines(fullPath),
    ])
    const tokens = typeof tokRes.data === 'number' ? tokRes.data : 0
    const lines = typeof lineRes.data === 'number' ? lineRes.data : 0
    const file: FileEntry = { id: uuidv4(), name, fullPath, tokens, lines }
    set((state) => ({ files: [...state.files, file] }))
  },
  handleFileChanged: async (fullPath) => {
    const [tokRes, lineRes] = await Promise.all([
      window.api.fs.estimateTokens(fullPath),
      window.api.fs.estimateLines(fullPath),
    ])
    const tokens = typeof tokRes.data === 'number' ? tokRes.data : 0
    const lines = typeof lineRes.data === 'number' ? lineRes.data : 0
    set((state) => ({
      files: state.files.map((f) => (f.fullPath === fullPath ? { ...f, tokens, lines } : f)),
    }))
  },
  handleFileRemoved: (fullPath) => {
    set((state) => ({ files: state.files.filter((f) => f.fullPath !== fullPath) }))
  },
  toggleSelected: (id) => {
    set((state) => {
      const selected = new Set(state.selected)
      if (selected.has(id)) selected.delete(id)
      else selected.add(id)
      return { selected }
    })
  },
  selectAll: () => {
    const filtered = get().files.filter((f) => f.name.toLowerCase().includes(get().search.toLowerCase()))
    const selected = new Set(filtered.map((f) => f.id))
    set({ selected })
  },
  clearAll: () => set({ selected: new Set() }),
  setSearch: (search) => set({ search }),
  setFolderPath: (folderPath) => {
    if (folderPath) localStorage.setItem('lastFolderPath', folderPath)
    else localStorage.removeItem('lastFolderPath')
    set({ folderPath, selected: new Set(), search: '' })
  },
  initFromLastFolder: async () => {
    if (get().initialized || get().folderPath) return
    const last = localStorage.getItem('lastFolderPath')
    if (!last) {
      set({ initialized: true })
      return
    }
    set({ initialized: true })
    get().setFolderPath(last)
    set({ files: [], selected: new Set(), search: '' })
    const res = await window.api.fs.openFolderDirect(last)
    if (!res.ok) get().setFolderPath(null)
  },
  selectFolder: async () => {
    const picked = await window.api.fs.selectFolder()
    const data = picked.data
    const selectedPath: string | undefined = Array.isArray(data) ? data[0] : data
    if (selectedPath) get().setFolderPath(selectedPath)
  },
  copyGitDiff: async () => window.api.git.copyDiff(),
  copyFileTree: async () => {
    const { files, folderPath } = get()
    if (!folderPath || files.length === 0) return { success: false, error: 'Nothing to copy' }
    try {
      const text = buildAsciiTree(files, folderPath)
      await navigator.clipboard.writeText(text)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Clipboard write failed' }
    }
  },
  copySelectedFiles: async (includeTree, promptType, instructions) => {
    const { files, selected } = get()
    const selectedPaths = files.filter(f => selected.has(f.id)).map(f => f.fullPath)
    return window.api.fs.copySelectedFiles(selectedPaths, includeTree, promptType, instructions)
  },
}))

let listenersSetup = false
const setupListeners = () => {
  if (listenersSetup) return
  listenersSetup = true
  const { handleInitialFiles, handleFileAdded, handleFileChanged, handleFileRemoved } = useExplorerStore.getState()
  window.api.fs.onFilesInitial(handleInitialFiles)
  window.api.fs.onFileAdded(handleFileAdded)
  window.api.fs.onFileChanged(handleFileChanged)
  window.api.fs.onFileRemoved(handleFileRemoved)
}

setupListeners()

export default useExplorerStore

export function getActions() {
  const s = useExplorerStore.getState()
  return {
    selectFolder: s.selectFolder,
    copyFileTree: s.copyFileTree,
  }
}
