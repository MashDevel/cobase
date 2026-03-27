import { create } from 'zustand'
import useShellStore from '../../shell/store'

export type EditorBuffer = {
  path: string
  name: string
  value: string
  savedValue: string
  loading: boolean
  saving: boolean
  error: string | null
}

export type TerminalSession = {
  id: string
  title: string
  cwd: string | null
  exited: boolean
  exitCode: number | null
  output: string
}

type EditorState = {
  activePath: string | null
  openOrder: string[]
  buffers: Record<string, EditorBuffer>
  terminalSessions: TerminalSession[]
  activeTerminalSessionId: string | null
  terminalVisible: boolean
  openFile: (path: string) => Promise<void>
  setActivePath: (path: string) => void
  updateValue: (path: string, value: string) => void
  saveActive: () => Promise<{ ok: boolean; error?: string }>
  reloadActive: () => Promise<{ ok: boolean; error?: string }>
  closeFile: (path: string) => void
  renameEntry: (fromPath: string, toPath: string) => void
  removeEntry: (path: string) => void
  closeOthers: (path: string) => void
  closeLeft: (path: string) => void
  closeRight: (path: string) => void
  createTerminalSession: (cwd: string | null) => Promise<{ ok: boolean; error?: string }>
  setActiveTerminalSession: (sessionId: string) => void
  setTerminalVisible: (visible: boolean) => void
  toggleTerminalVisible: () => void
  markTerminalExited: (sessionId: string, code: number | null) => void
  closeTerminalSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>
  appendTerminalOutput: (sessionId: string, data: string) => void
}

const getName = (path: string) => path.split(/[\\/]/).pop() || path
const getTerminalTitle = (index: number) => `Session ${index + 1}`
const matchesPath = (candidate: string, target: string) => candidate === target || candidate.startsWith(`${target}/`)
const remapPath = (candidate: string, fromPath: string, toPath: string) =>
  candidate === fromPath ? toPath : candidate.startsWith(`${fromPath}/`) ? `${toPath}${candidate.slice(fromPath.length)}` : candidate

const useEditorStore = create<EditorState>((set, get) => ({
  activePath: null,
  openOrder: [],
  buffers: {},
  terminalSessions: [],
  activeTerminalSessionId: null,
  terminalVisible: true,
  openFile: async (path) => {
    const existing = get().buffers[path]
    if (existing && !existing.loading) {
      set({ activePath: path })
      useShellStore.setState({ activePluginId: 'editor' })
      return
    }
    set((state) => ({
      activePath: path,
      openOrder: state.openOrder.includes(path) ? state.openOrder : [...state.openOrder, path],
      buffers: {
        ...state.buffers,
        [path]: existing || {
          path,
          name: getName(path),
          value: '',
          savedValue: '',
          loading: true,
          saving: false,
          error: null,
        },
      },
    }))
    const result = await window.api.fs.readTextFile(path)
    if (!result.ok) {
      set((state) => ({
        buffers: {
          ...state.buffers,
          [path]: {
            ...(state.buffers[path] || {
              path,
              name: getName(path),
              value: '',
              savedValue: '',
              saving: false,
            }),
            loading: false,
            error: result.error?.message || 'Failed to open file',
          },
        },
      }))
      useShellStore.setState({ activePluginId: 'editor' })
      return
    }
    const data = result.data!
    set((state) => ({
      activePath: data.path,
      openOrder: state.openOrder.map((item) => item === path ? data.path : item),
      buffers: Object.fromEntries(
        Object.entries(state.buffers)
          .filter(([key]) => key !== path)
          .concat([[
            data.path,
            {
              path: data.path,
              name: getName(data.path),
              value: data.content,
              savedValue: data.content,
              loading: false,
              saving: false,
              error: null,
            },
          ]])
      ),
    }))
    useShellStore.setState({ activePluginId: 'editor' })
  },
  setActivePath: (path) => set({ activePath: path }),
  updateValue: (path, value) => {
    set((state) => {
      const buffer = state.buffers[path]
      if (!buffer) return state
      return {
        buffers: {
          ...state.buffers,
          [path]: {
            ...buffer,
            value,
          },
        },
      }
    })
  },
  saveActive: async () => {
    const path = get().activePath
    if (!path) return { ok: false, error: 'No file open' }
    const buffer = get().buffers[path]
    if (!buffer || buffer.loading || buffer.saving) return { ok: false, error: 'File is busy' }
    set((state) => ({
      buffers: {
        ...state.buffers,
        [path]: {
          ...state.buffers[path],
          saving: true,
          error: null,
        },
      },
    }))
    const result = await window.api.fs.writeTextFile(path, buffer.value)
    if (!result.ok) {
      set((state) => ({
        buffers: {
          ...state.buffers,
          [path]: {
            ...state.buffers[path],
            saving: false,
            error: result.error?.message || 'Failed to save file',
          },
        },
      }))
      return { ok: false, error: result.error?.message || 'Failed to save file' }
    }
    const data = result.data!
    set((state) => ({
      activePath: data.path,
      openOrder: state.openOrder.map((item) => item === path ? data.path : item),
      buffers: Object.fromEntries(
        Object.entries(state.buffers)
          .filter(([key]) => key !== path)
          .concat([[
            data.path,
            {
              ...state.buffers[path],
              path: data.path,
              name: getName(data.path),
              value: data.content,
              savedValue: data.content,
              loading: false,
              saving: false,
              error: null,
            },
          ]])
      ),
    }))
    return { ok: true }
  },
  reloadActive: async () => {
    const path = get().activePath
    if (!path) return { ok: false, error: 'No file open' }
    set((state) => ({
      buffers: {
        ...state.buffers,
        [path]: {
          ...state.buffers[path],
          loading: true,
          error: null,
        },
      },
    }))
    const result = await window.api.fs.readTextFile(path)
    if (!result.ok) {
      set((state) => ({
        buffers: {
          ...state.buffers,
          [path]: {
            ...state.buffers[path],
            loading: false,
            error: result.error?.message || 'Failed to reload file',
          },
        },
      }))
      return { ok: false, error: result.error?.message || 'Failed to reload file' }
    }
    const data = result.data!
    set((state) => ({
      activePath: data.path,
      openOrder: state.openOrder.map((item) => item === path ? data.path : item),
      buffers: Object.fromEntries(
        Object.entries(state.buffers)
          .filter(([key]) => key !== path)
          .concat([[
            data.path,
            {
              path: data.path,
              name: getName(data.path),
              value: data.content,
              savedValue: data.content,
              loading: false,
              saving: false,
              error: null,
            },
          ]])
      ),
    }))
    return { ok: true }
  },
  closeFile: (path) => {
    set((state) => {
      const nextOrder = state.openOrder.filter((item) => item !== path)
      const nextActivePath = state.activePath === path ? nextOrder[nextOrder.length - 1] || null : state.activePath
      const { [path]: _, ...buffers } = state.buffers
      return {
        activePath: nextActivePath,
        openOrder: nextOrder,
        buffers,
      }
    })
  },
  renameEntry: (fromPath, toPath) => {
    set((state) => {
      const nextBuffers = Object.fromEntries(
        Object.values(state.buffers).map((buffer) => {
          const path = remapPath(buffer.path, fromPath, toPath)
          return [path, { ...buffer, path, name: getName(path) }]
        })
      )
      const nextOrder = state.openOrder.map((path) => remapPath(path, fromPath, toPath))
      return {
        activePath: state.activePath ? remapPath(state.activePath, fromPath, toPath) : null,
        openOrder: nextOrder,
        buffers: nextBuffers,
      }
    })
  },
  removeEntry: (path) => {
    set((state) => {
      const nextOrder = state.openOrder.filter((item) => !matchesPath(item, path))
      const nextActivePath = state.activePath && matchesPath(state.activePath, path)
        ? nextOrder[nextOrder.length - 1] || null
        : state.activePath
      const buffers = Object.fromEntries(
        Object.entries(state.buffers).filter(([key]) => !matchesPath(key, path))
      )
      return {
        activePath: nextActivePath,
        openOrder: nextOrder,
        buffers,
      }
    })
  },
  closeOthers: (path) => {
    set((state) => {
      if (!state.openOrder.includes(path)) return state
      const buffer = state.buffers[path]
      if (!buffer) return state
      return {
        activePath: path,
        openOrder: [path],
        buffers: { [path]: buffer },
      }
    })
  },
  closeLeft: (path) => {
    set((state) => {
      const index = state.openOrder.indexOf(path)
      if (index <= 0) return state
      const keep = state.openOrder.slice(index)
      const buffers = Object.fromEntries(keep.map((item) => [item, state.buffers[item]]).filter(([, buffer]) => Boolean(buffer)))
      return {
        activePath: keep.includes(state.activePath || '') ? state.activePath : path,
        openOrder: keep,
        buffers,
      }
    })
  },
  closeRight: (path) => {
    set((state) => {
      const index = state.openOrder.indexOf(path)
      if (index < 0 || index === state.openOrder.length - 1) return state
      const keep = state.openOrder.slice(0, index + 1)
      const buffers = Object.fromEntries(keep.map((item) => [item, state.buffers[item]]).filter(([, buffer]) => Boolean(buffer)))
      return {
        activePath: keep.includes(state.activePath || '') ? state.activePath : path,
        openOrder: keep,
        buffers,
      }
    })
  },
  createTerminalSession: async (cwd) => {
    const result = await window.api.terminal.start(cwd)
    if (!result.ok) {
      return { ok: false, error: result.error?.message || 'Failed to start terminal session' }
    }
    const sessionId = result.data!
    set((state) => ({
      terminalSessions: state.terminalSessions.concat({
        id: sessionId,
        title: getTerminalTitle(state.terminalSessions.length),
        cwd,
        exited: false,
        exitCode: null,
        output: '',
      }),
      activeTerminalSessionId: sessionId,
    }))
    return { ok: true }
  },
  setActiveTerminalSession: (sessionId) => {
    set((state) => state.terminalSessions.some((session) => session.id === sessionId)
      ? { activeTerminalSessionId: sessionId }
      : state)
  },
  setTerminalVisible: (visible) => set({ terminalVisible: visible }),
  toggleTerminalVisible: () => set((state) => ({ terminalVisible: !state.terminalVisible })),
  markTerminalExited: (sessionId, code) => {
    set((state) => ({
      terminalSessions: state.terminalSessions.map((session) => session.id === sessionId
        ? {
            ...session,
            exited: true,
            exitCode: code,
          }
        : session),
    }))
  },
  closeTerminalSession: async (sessionId) => {
    const result = await window.api.terminal.close(sessionId)
    if (!result.ok) {
      return { ok: false, error: result.error?.message || 'Failed to close terminal session' }
    }
    set((state) => {
      const terminalSessions = state.terminalSessions.filter((session) => session.id !== sessionId)
      const activeTerminalSessionId = state.activeTerminalSessionId === sessionId
        ? terminalSessions[0]?.id || null
        : state.activeTerminalSessionId
      return {
      terminalSessions,
      activeTerminalSessionId,
      }
    })
    return { ok: true }
  },
  appendTerminalOutput: (sessionId, data) => {
    if (!data) return
    set((state) => ({
      terminalSessions: state.terminalSessions.map((session) => session.id === sessionId
        ? {
            ...session,
            output: `${session.output}${data}`.slice(-200000),
          }
        : session),
    }))
  },
}))

export default useEditorStore

export function openEditorFile(path: string) {
  return useEditorStore.getState().openFile(path)
}
