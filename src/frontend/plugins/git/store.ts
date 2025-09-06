import { create } from 'zustand'

type FileEntry = { path: string; status: string; from?: string }
type Status = {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  detached: boolean
  merging: boolean
  staged: FileEntry[]
  unstaged: FileEntry[]
  untracked: FileEntry[]
}

type Commit = { sha: string; parents: string[]; authorName: string; authorEmail: string; date: string; subject: string }
type CommitDetails = Commit & { files: FileEntry[] }
type BlameLine = { sha: string; author: string; content: string }
type Branch = { name: string; sha: string; head: boolean; upstream: string | null; ahead: number; behind: number }

type GitState = {
  loading: boolean
  error: string | null
  status: Status | null
  selectedTab: 'changes' | 'history'
  selectedPath: string | null
  stagedSelected: Set<string>
  unstagedSelected: Set<string>
  untrackedSelected: Set<string>
  diff: string | null
  commitMessage: string
  commitSummary: string
  commitBody: string
  history: Commit[]
  historyFilters: { author: string; grep: string; path: string }
  historySkip: number
  historyLimit: number
  selectedCommit: string | null
  commitDetails: CommitDetails | null
  commitPatch: string | null
  commitSelectedFile: string | null
  blame: BlameLine[] | null
  branches: Branch[]
  newBranch: string
  lastAction: { kind: 'stage' | 'unstage' | 'discard'; paths: string[] } | null
}

type GitActions = {
  setTab: (tab: GitState['selectedTab']) => void
  refresh: () => Promise<void>
  toggleStaged: (p: string) => void
  toggleUnstaged: (p: string) => void
  toggleUntracked: (p: string) => void
  selectPath: (p: string | null, staged: boolean) => Promise<void>
  setFileStaged: (path: string, staged: boolean) => Promise<void>
  discardFile: (path: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  fetchBlame: (rev?: string) => Promise<void>
  stageSelected: () => Promise<{ ok: boolean; message?: string }>
  unstageSelected: () => Promise<{ ok: boolean; message?: string }>
  discardSelected: () => Promise<{ ok: boolean; message?: string }>
  commit: () => Promise<{ ok: boolean; sha?: string; message?: string }>
  setCommitMessage: (m: string) => void
  setCommitSummary: (s: string) => void
  setCommitBody: (b: string) => void
  loadHistory: () => Promise<void>
  setHistoryFilter: (k: 'author' | 'grep' | 'path', v: string) => void
  pageHistory: (dir: 1 | -1) => Promise<void>
  selectCommit: (sha: string | null) => Promise<void>
  selectCommitFile: (path: string | null) => Promise<void>
  loadCommitPatch: (sha: string, path?: string | null) => Promise<void>
  copyCommitPatch: (sha: string) => Promise<{ ok: boolean; message?: string }>
  copyRangePrompt: (from: string | null, to: string, tokenBudget: number) => Promise<{ ok: boolean; message?: string }>
  loadBranches: () => Promise<void>
  createBranch: (name: string, checkout: boolean) => Promise<{ ok: boolean; message?: string }>
  switchBranch: (name: string, force?: boolean) => Promise<{ ok: boolean; message?: string; code?: string }>
  setNewBranch: (s: string) => void
  undo: () => Promise<void>
}

const useGitStore = create<GitState & { actions: GitActions }>((set, get) => ({
  loading: false,
  error: null,
  status: null,
  selectedTab: 'changes',
  selectedPath: null,
  stagedSelected: new Set(),
  unstagedSelected: new Set(),
  untrackedSelected: new Set(),
  diff: null,
  commitMessage: '',
  commitSummary: '',
  commitBody: '',
  history: [],
  historyFilters: { author: '', grep: '', path: '' },
  historySkip: 0,
  historyLimit: 50,
  selectedCommit: null,
  commitDetails: null,
  commitPatch: null,
  commitSelectedFile: null,
  blame: null,
  branches: [],
  newBranch: '',
  lastAction: null,
  actions: {
    setTab: (tab) => set({ selectedTab: tab }),
    refresh: async () => {
      set({ loading: true, error: null })
      const res = await window.api.git.status()
      if (res.ok && res.data) set({ status: res.data })
      else set({ error: res.error?.message || 'Git status failed' })
      set({ loading: false })
    },
    toggleStaged: (p) => set((s) => {
      const ns = new Set(s.stagedSelected)
      if (ns.has(p)) ns.delete(p); else ns.add(p)
      return { stagedSelected: ns }
    }),
    toggleUnstaged: (p) => set((s) => {
      const ns = new Set(s.unstagedSelected)
      if (ns.has(p)) ns.delete(p); else ns.add(p)
      return { unstagedSelected: ns }
    }),
    toggleUntracked: (p) => set((s) => {
      const ns = new Set(s.untrackedSelected)
      if (ns.has(p)) ns.delete(p); else ns.add(p)
      return { untrackedSelected: ns }
    }),
    selectPath: async (p, staged) => {
      set({ selectedPath: p, diff: null, blame: null })
      if (!p) return
      const res = await window.api.git.diffFile(p, !!staged)
      if (res.ok) set({ diff: res.data || '' })
    },
    setFileStaged: async (path, staged) => {
      if (staged) await window.api.git.stage([path])
      else await window.api.git.unstage([path])
      await get().actions.refresh()
      if (get().selectedPath === path) {
        const nowStaged = !!(get().status?.staged || []).find(f => f.path === path)
        await get().actions.selectPath(path, nowStaged)
      }
    },
    discardFile: async (path) => {
      await window.api.git.discard([path])
      await get().actions.refresh()
      if (get().selectedPath === path) set({ selectedPath: null, diff: null })
    },
    stageAll: async () => {
      const files = [...(get().status?.unstaged || []).map(f => f.path), ...(get().status?.untracked || []).map(f => f.path)]
      if (files.length) await window.api.git.stage(files)
      await get().actions.refresh()
    },
    unstageAll: async () => {
      const files = (get().status?.staged || []).map(f => f.path)
      if (files.length) await window.api.git.unstage(files)
      await get().actions.refresh()
    },
    fetchBlame: async (rev) => {
      const { selectedPath } = get()
      if (!selectedPath) return
      const res = await window.api.git.blame(selectedPath, rev)
      if (res.ok) set({ blame: res.data || [] })
    },
    stageSelected: async () => {
      const { unstagedSelected, untrackedSelected } = get()
      const paths = [...unstagedSelected, ...untrackedSelected]
      if (paths.length === 0) return { ok: true }
      const res = await window.api.git.stage(paths)
      if (!res.ok) return { ok: false, message: res.error?.message }
      set({ lastAction: { kind: 'stage', paths } })
      await get().actions.refresh()
      return { ok: true }
    },
    unstageSelected: async () => {
      const { stagedSelected } = get()
      const paths = [...stagedSelected]
      if (paths.length === 0) return { ok: true }
      const res = await window.api.git.unstage(paths)
      if (!res.ok) return { ok: false, message: res.error?.message }
      set({ lastAction: { kind: 'unstage', paths } })
      await get().actions.refresh()
      return { ok: true }
    },
    discardSelected: async () => {
      const { unstagedSelected, untrackedSelected } = get()
      const paths = [...unstagedSelected, ...untrackedSelected]
      if (paths.length === 0) return { ok: true }
      const res = await window.api.git.discard(paths)
      if (!res.ok) return { ok: false, message: res.error?.message }
      set({ lastAction: { kind: 'discard', paths } })
      await get().actions.refresh()
      return { ok: true }
    },
    commit: async () => {
      const { commitSummary, commitBody } = get()
      const msg = commitBody && commitBody.trim() ? `${commitSummary.trim()}\n\n${commitBody}` : commitSummary
      const res = await window.api.git.commit(msg)
      if (!res.ok) return { ok: false, message: res.error?.message }
      set({ commitMessage: '', commitSummary: '', commitBody: '' })
      await get().actions.refresh()
      return { ok: true, sha: res.data?.sha }
    },
    setCommitMessage: (m) => set({ commitMessage: m }),
    setCommitSummary: (sVal) => set({ commitSummary: sVal }),
    setCommitBody: (bVal) => set({ commitBody: bVal }),
    loadHistory: async () => {
      const { historySkip, historyLimit, historyFilters } = get()
      const res = await window.api.git.log({ skip: historySkip, limit: historyLimit, author: historyFilters.author || undefined, grep: historyFilters.grep || undefined, path: historyFilters.path || undefined })
      if (res.ok) set({ history: res.data || [] })
    },
    setHistoryFilter: (k, v) => set((s) => ({ historyFilters: { ...s.historyFilters, [k]: v } })),
    pageHistory: async (dir) => {
      const { historySkip, historyLimit } = get()
      const next = Math.max(0, historySkip + dir * historyLimit)
      set({ historySkip: next })
      await get().actions.loadHistory()
    },
    selectCommit: async (sha) => {
      set({ selectedCommit: sha, commitDetails: null, commitPatch: null, commitSelectedFile: null })
      if (!sha) return
      const res = await window.api.git.commitDetails(sha)
      if (res.ok) set({ commitDetails: res.data || null })
      await get().actions.loadCommitPatch(sha)
    },
    selectCommitFile: async (path) => {
      set({ commitSelectedFile: path || null })
      const sha = get().selectedCommit
      if (!sha) return
      await get().actions.loadCommitPatch(sha, path || undefined)
    },
    loadCommitPatch: async (sha, path) => {
      const res = await window.api.git.showPatch(sha, path)
      if (res.ok) set({ commitPatch: res.data || '' })
    },
    copyCommitPatch: async (sha) => {
      const res = await window.api.git.copyCommitPatch(sha)
      if (!res.ok) return { ok: false, message: res.error?.message }
      return { ok: true }
    },
    copyRangePrompt: async (from, to, tokenBudget) => {
      const res = await window.api.git.copyRangePrompt(from, to, tokenBudget)
      if (!res.ok) return { ok: false, message: res.error?.message }
      return { ok: true }
    },
    loadBranches: async () => {
      const res = await window.api.git.branches()
      if (res.ok) set({ branches: res.data || [] })
    },
    createBranch: async (name, checkout) => {
      const res = await window.api.git.branchCreate(name, checkout)
      if (!res.ok) return { ok: false, message: res.error?.message }
      await get().actions.loadBranches()
      await get().actions.refresh()
      set({ newBranch: '' })
      return { ok: true }
    },
    switchBranch: async (name, force) => {
      const res = await window.api.git.switch(name, !!force)
      if (!res.ok) return { ok: false, message: res.error?.message, code: (res as any).error?.code }
      await get().actions.refresh()
      return { ok: true }
    },
    setNewBranch: (sNew) => set({ newBranch: sNew }),
    undo: async () => {
      const a = get().lastAction
      if (!a) return
      if (a.kind === 'stage') await window.api.git.unstage(a.paths)
      else if (a.kind === 'unstage') await window.api.git.stage(a.paths)
      else if (a.kind === 'discard') {}
      set({ lastAction: null })
      await get().actions.refresh()
    },
  },
}))

export default useGitStore
export const getGitActions = () => useGitStore.getState().actions
