import { FileEntry } from './store'
import type { ExplorerState } from './store'

function memoizeByRefs<I extends any[], R>(getInputs: (s: ExplorerState) => [...I], compute: (...args: I) => R) {
  let lastInputs: I | null = null
  let lastResult: R | null = null
  return (s: ExplorerState): R => {
    const inputs = getInputs(s)
    if (lastInputs && inputs.length === lastInputs.length && inputs.every((v, i) => v === lastInputs![i])) {
      return lastResult as R
    }
    const res = compute(...inputs)
    lastInputs = inputs
    lastResult = res
    return res
  }
}

export const selectFilteredFiles = memoizeByRefs(
  (s) => [s.files, s.search] as const,
  (files, search) => files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
)

export const selectSelectedFiles = memoizeByRefs(
  (s) => [s.files, s.selected] as const,
  (files, selected) => files.filter((f) => selected.has(f.id))
)

export const selectSelectedCount = (s: ExplorerState) => selectSelectedFiles(s).length

export const selectSelectedTotalTokens = (s: ExplorerState) => selectSelectedFiles(s).reduce((acc: number, f: FileEntry) => acc + f.tokens, 0)

export const selectSelectedTotalLines = (s: ExplorerState) => selectSelectedFiles(s).reduce((acc: number, f: FileEntry) => acc + f.lines, 0)
