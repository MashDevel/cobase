import type { State } from './store';

// Simple memoizer that caches the last inputs by reference and returns
// the same result instance if inputs haven't changed.
function memoizeByRefs<I extends any[], R>(
  getInputs: (s: State) => [...I],
  compute: (...args: I) => R
) {
  let lastInputs: I | null = null;
  let lastResult: R | null = null;
  return (s: State): R => {
    const inputs = getInputs(s);
    if (
      lastInputs &&
      inputs.length === lastInputs.length &&
      inputs.every((v, i) => v === lastInputs![i])
    ) {
      return lastResult as R;
    }
    const res = compute(...inputs);
    lastInputs = inputs;
    lastResult = res;
    return res;
  };
}

export const selectFilteredFiles = memoizeByRefs(
  (s) => [s.files, s.search] as const,
  (files, search) =>
    files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
);

export const selectSelectedFiles = memoizeByRefs(
  (s) => [s.files, s.selected] as const,
  (files, selected) => files.filter((f) => selected.has(f.id))
);

export const selectSelectedCount = (s: State) => selectSelectedFiles(s).length;

export const selectSelectedTotalTokens = (s: State) =>
  selectSelectedFiles(s).reduce((sum, f) => sum + f.tokens, 0);

export const selectSelectedTotalLines = (s: State) =>
  selectSelectedFiles(s).reduce((sum, f) => sum + f.lines, 0);
