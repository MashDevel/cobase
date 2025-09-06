import { create } from 'zustand';
import { buildAsciiTree } from './services/tree';
const uuidv4 = () => crypto.randomUUID();

export type FileEntry = {
  id: string;
  name: string;
  fullPath: string;
  tokens: number;
};

export type State = {
  files: FileEntry[];
  selected: Set<string>;
  search: string;
  folderPath: string | null;
  handleInitialFiles: (list: { fullPath: string; name: string; tokens?: number }[]) => Promise<void>;
  handleFileAdded: (fullPath: string) => Promise<void>;
  handleFileChanged: (fullPath: string) => Promise<void>;
  handleFileRemoved: (fullPath: string) => void;
  // selection + filters
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  setSearch: (search: string) => void;
  setFolderPath: (path: string | null) => void;
  // app actions
  initFromLastFolder: () => Promise<void>;
  selectFolder: () => Promise<void>;
  copyGitDiff: () => Promise<{ success: boolean; diffLength?: number; error?: string }>;
  copyFileTree: () => Promise<{ success: boolean; error?: string }>;
  copySelectedFiles: (
    includeTree: boolean,
    promptType: string,
    instructions: string
  ) => Promise<boolean>;
  applyPatch: (patchText: string) => Promise<{ success: boolean; error?: string }>;
};

const useStore = create<State>((set, get) => ({
  files: [],
  selected: new Set(),
  search: '',
  folderPath: null,

  handleInitialFiles: async (list) => {
    const files: FileEntry[] = list.map((f) => ({
      id: uuidv4(),
      name: f.name,
      fullPath: f.fullPath,
      tokens: typeof f.tokens === 'number' ? f.tokens : 0,
    }));
    set({ files });
  },

  handleFileAdded: async (fullPath) => {
    const name = fullPath.split(/[\\\/]/).pop()!;
    const tokens = await window.electronAPI.estimateTokens(fullPath);
    const file: FileEntry = {
      id: uuidv4(),
      name,
      fullPath,
      tokens,
    };
    set((state) => ({ files: [...state.files, file] }));
  },

  handleFileChanged: async (fullPath) => {
    const tokens = await window.electronAPI.estimateTokens(fullPath);
    set((state) => ({
      files: state.files.map((f) =>
        f.fullPath === fullPath ? { ...f, tokens } : f
      ),
    }));
  },

  handleFileRemoved: (fullPath) => {
    set((state) => ({
      files: state.files.filter((f) => f.fullPath !== fullPath),
    }));
  },

  toggleSelected: (id) => {
    set((state) => {
      const selected = new Set(state.selected);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return { selected };
    });
  },

  selectAll: () => {
    const filtered = get().files.filter((f) =>
      f.name.toLowerCase().includes(get().search.toLowerCase())
    );
    const selected = new Set(filtered.map((f) => f.id));
    set({ selected });
  },
  clearAll: () => set({ selected: new Set() }),
  setSearch: (search) => set({ search }),
  setFolderPath: (folderPath) => {
    if (folderPath) {
      localStorage.setItem('lastFolderPath', folderPath);
    } else {
      localStorage.removeItem('lastFolderPath');
    }
    set({ folderPath, selected: new Set(), search: '' });
  },

  // Initialize from last opened folder if available
  initFromLastFolder: async () => {
    const last = localStorage.getItem('lastFolderPath');
    if (!last) return;
    get().setFolderPath(last);
    set({ files: [], selected: new Set(), search: '' });
    const path = await window.electronAPI.openFolderDirect(last);
    if (!path) {
      get().setFolderPath(null);
    }
  },

  // Show folder picker and set folder path
  selectFolder: async () => {
    const picked: any = await window.electronAPI.selectFolder();
    const selectedPath: string | undefined = Array.isArray(picked) ? picked[0] : picked;
    if (selectedPath) {
      get().setFolderPath(selectedPath);
    }
  },

  // Copy current git diff via backend
  copyGitDiff: async () => {
    const result = await window.electronAPI.copyGitDiff();
    return result;
  },

  // Build ASCII tree from current files and copy to clipboard
  copyFileTree: async () => {
    const { files, folderPath } = get();
    if (!folderPath || files.length === 0) {
      return { success: false, error: 'Nothing to copy' };
    }
    try {
      const text = buildAsciiTree(files, folderPath);
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Clipboard write failed' };
    }
  },

  // Copy selected files via backend with options
  copySelectedFiles: async (includeTree, promptType, instructions) => {
    const { files, selected } = get();
    const selectedPaths = files
      .filter(f => selected.has(f.id))
      .map(f => f.fullPath);
    return window.electronAPI.copySelectedFiles(
      selectedPaths,
      includeTree,
      promptType,
      instructions,
    );
  },

  // Apply a unified patch via backend
  applyPatch: async (patchText) => {
    const result = await window.electronAPI.applyPatch(patchText as any);
    return result;
  },
}));

let listenersSetup = false;
const setupListeners = () => {
  if (listenersSetup) return;
  listenersSetup = true;
  const {
    handleInitialFiles,
    handleFileAdded,
    handleFileChanged,
    handleFileRemoved,
  } = useStore.getState();

  window.electronAPI.onFilesInitial(handleInitialFiles);
  window.electronAPI.onFileAdded(handleFileAdded);
  window.electronAPI.onFileChanged(handleFileChanged);
  window.electronAPI.onFileRemoved(handleFileRemoved);
};

setupListeners();

export default useStore;
