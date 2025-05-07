import { create } from 'zustand';
const uuidv4 = () => crypto.randomUUID();

type FileEntry = {
  id: string;
  name: string;
  path: string;
  tokens: number;
};

type State = {
  files: FileEntry[];
  selected: Set<string>;
  search: string;
  folderPath: string | null;
  handleInitialFiles: (list: { fullPath: string; name: string }[]) => Promise<void>;
  handleFileAdded: (fullPath: string) => Promise<void>;
  handleFileChanged: (fullPath: string) => Promise<void>;
  handleFileRemoved: (fullPath: string) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  setSearch: (search: string) => void;
  setFolderPath: (path: string | null) => void;
};

const useStore = create<State>((set, get) => ({
  files: [],
  selected: new Set(),
  search: '',
  folderPath: null,

  handleInitialFiles: async (list) => {
    const files = await Promise.all(
      list.map(async (f) => ({
        id: uuidv4(),
        name: f.name,
        path: f.fullPath.replace(`/${f.name}`, ''),
        tokens: await window.electronAPI.readTokens(f.fullPath),
      }))
    );
    set({ files });
  },

  handleFileAdded: async (fullPath) => {
    const name = fullPath.split('/').pop()!;
    const tokens = await window.electronAPI.readTokens(fullPath);
    const file = {
      id: uuidv4(),
      name,
      path: fullPath.replace(`/${name}`, ''),
      tokens,
    };
    set((state) => ({ files: [...state.files, file] }));
  },

  handleFileChanged: async (fullPath) => {
    const tokens = await window.electronAPI.readTokens(fullPath);
    set((state) => ({
      files: state.files.map((f) =>
        `${f.path}/${f.name}` === fullPath ? { ...f, tokens } : f
      ),
    }));
  },

  handleFileRemoved: (fullPath) => {
    set((state) => ({
      files: state.files.filter((f) => `${f.path}/${f.name}` !== fullPath),
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
    set({ 
      folderPath,
      files: [],
      selected: new Set(),
      search: ''
    });
  },
}));

const setupListeners = () => {
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