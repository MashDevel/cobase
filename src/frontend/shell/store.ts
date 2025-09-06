import { create } from 'zustand'

type ShellState = {
  activePluginId: string
  setActivePluginId: (id: string) => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
  statusText: string | null
  setStatusText: (t: string | null) => void
  theme: 'light' | 'dark' | 'system'
  setTheme: (t: 'light' | 'dark' | 'system') => void
}

const useShellStore = create<ShellState>((set) => ({
  activePluginId: 'explorer',
  setActivePluginId: (id) => set({ activePluginId: id }),
  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
  statusText: null,
  setStatusText: (t) => set({ statusText: t }),
  theme: 'system',
  setTheme: (t) => set({ theme: t }),
}))

export default useShellStore

