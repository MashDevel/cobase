export {};

declare global {
  type ApiError = { code: string; message: string }
  type ApiResult<T> = { ok: boolean; data?: T; error?: ApiError }

  interface Window {
    api: {
      fs: {
        selectFolder: () => Promise<ApiResult<string | string[] | undefined>>
        openFolderDirect: (path: string) => Promise<ApiResult<string>>
        estimateTokens: (path: string) => Promise<ApiResult<number>>
        estimateLines: (path: string) => Promise<ApiResult<number>>
        onFilesInitial: (
          callback: (files: { fullPath: string; name: string; tokens?: number; lines?: number }[]) => void
        ) => (() => void) | void
        onFileAdded: (callback: (fullPath: string) => void) => (() => void) | void
        onFileChanged: (callback: (fullPath: string) => void) => (() => void) | void
        onFileRemoved: (callback: (fullPath: string) => void) => (() => void) | void
        copySelectedFiles: (
          paths: string[],
          includeTree: boolean,
          promptType: string,
          instructions: string
        ) => Promise<ApiResult<true>>
      }
      git: {
        copyDiff: () => Promise<ApiResult<{ diffLength: number }>>
        status: () => Promise<ApiResult<{ branch: string | null; upstream: string | null; ahead: number; behind: number; detached: boolean; merging: boolean; staged: { path: string; status: string; from?: string }[]; unstaged: { path: string; status: string; from?: string }[]; untracked: { path: string; status: string }[] }>>
        diffFile: (path: string, staged?: boolean) => Promise<ApiResult<string>>
        stage: (paths: string[]) => Promise<ApiResult<true>>
        unstage: (paths: string[]) => Promise<ApiResult<true>>
        discard: (paths: string[]) => Promise<ApiResult<true>>
        commit: (message: string) => Promise<ApiResult<{ sha: string }>>
        log: (params: { skip?: number; limit?: number; author?: string; grep?: string; path?: string }) => Promise<ApiResult<{ sha: string; parents: string[]; authorName: string; authorEmail: string; date: string; subject: string }[]>>
        commitDetails: (sha: string) => Promise<ApiResult<{ sha: string; parents: string[]; authorName: string; authorEmail: string; date: string; subject: string; files: { path: string; status: string; from?: string }[] }>>
        blame: (path: string, rev?: string) => Promise<ApiResult<{ sha: string; author: string; content: string }[]>>
        branches: () => Promise<ApiResult<{ name: string; sha: string; head: boolean; upstream: string | null; ahead: number; behind: number }[]>>
        branchCreate: (name: string, checkout?: boolean) => Promise<ApiResult<true>>
        switch: (name: string, force?: boolean) => Promise<ApiResult<true>>
        copyCommitPatch: (sha: string) => Promise<ApiResult<{ length: number }>>
        copyRangePrompt: (from: string | null, to: string, tokenBudget?: number) => Promise<ApiResult<{ tokens: number }>>
        showPatch: (sha: string, path?: string | null) => Promise<ApiResult<string>>
      }
      patch: {
        apply: (patchText: string) => Promise<ApiResult<true>>
      }
      search: {
        run: (
          query: string,
          options?: { regex?: boolean; caseSensitive?: boolean; word?: boolean; perFile?: number; maxResults?: number }
        ) => Promise<ApiResult<{ path: string; line: number; preview: string; ranges: [number, number][] }[]>>
      }
    }
  }
}
