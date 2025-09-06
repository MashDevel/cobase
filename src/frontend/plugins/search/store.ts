import { create } from 'zustand'

export type SearchResult = {
  path: string
  line: number
  preview: string
  ranges: [number, number][]
}

export type SearchState = {
  query: string
  regex: boolean
  caseSensitive: boolean
  word: boolean
  perFile: number
  maxResults: number
  searching: boolean
  error: string | null
  results: SearchResult[]
  setQuery: (q: string) => void
  setRegex: (v: boolean) => void
  setCaseSensitive: (v: boolean) => void
  setWord: (v: boolean) => void
  setPerFile: (n: number) => void
  setMaxResults: (n: number) => void
  run: () => Promise<void>
}

const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  regex: false,
  caseSensitive: false,
  word: false,
  perFile: 3,
  maxResults: 500,
  searching: false,
  error: null,
  results: [],
  setQuery: (q) => set({ query: q }),
  setRegex: (v) => set({ regex: v }),
  setCaseSensitive: (v) => set({ caseSensitive: v }),
  setWord: (v) => set({ word: v }),
  setPerFile: (n) => set({ perFile: Math.max(1, Math.min(1000, n || 1)) }),
  setMaxResults: (n) => set({ maxResults: Math.max(1, Math.min(10000, n || 1)) }),
  run: async () => {
    const { query, regex, caseSensitive, word, perFile, maxResults } = get()
    if (!query.trim()) { set({ results: [], error: null }); return }
    set({ searching: true, error: null })
    const res = await window.api.search.run(query, { regex, caseSensitive, word, perFile, maxResults })
    if (res.ok) set({ results: Array.isArray(res.data) ? res.data : [], searching: false })
    else set({ error: res.error?.message || 'Search failed', searching: false })
  },
}))

export default useSearchStore

