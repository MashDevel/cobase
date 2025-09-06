export {};

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string[] | undefined>;
      onFilesInitial: (
        callback: (files: { fullPath: string; name: string; tokens?: number; lines?: number }[]) => void
      ) => void;
      onFileAdded: (callback: (fullPath: string) => void) => void;
      onFileChanged: (callback: (fullPath: string) => void) => void;
      onFileRemoved: (callback: (fullPath: string) => void) => void;
      readTokens: (path: string) => Promise<number>;
      estimateTokens: (path: string) => Promise<number>;
      estimateLines: (path: string) => Promise<number>;
      openFile: (path: string) => Promise<void>;
      copySelectedFiles: (
        paths: string[],
        includeTree: boolean,
        promptType: string,
        instructions: string
      ) => Promise<boolean>;
      copyGitDiff: () => Promise<{ success: boolean; diffLength?: number; error?: string }>;
      openFolderDirect: (path: string) => Promise<string | null>;
      applyPatch: (patchText: string) => Promise<{ success: boolean; error?: string }>;
    };
    api: {
      fs: {
        selectFolder: () => Promise<{ ok: boolean; data: string | string[] | undefined }>
        openFolderDirect: (path: string) => Promise<{ ok: boolean; data?: string; error?: { code: string; message: string } }>
        estimateTokens: (path: string) => Promise<{ ok: boolean; data?: number; error?: { code: string; message: string } }>
        estimateLines: (path: string) => Promise<{ ok: boolean; data?: number; error?: { code: string; message: string } }>
        onFilesInitial: (
          callback: (files: { fullPath: string; name: string; tokens?: number; lines?: number }[]) => void
        ) => void
        onFileAdded: (callback: (fullPath: string) => void) => void
        onFileChanged: (callback: (fullPath: string) => void) => void
        onFileRemoved: (callback: (fullPath: string) => void) => void
        copySelectedFiles: (
          paths: string[],
          includeTree: boolean,
          promptType: string,
          instructions: string
        ) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
      }
      git: {
        copyDiff: () => Promise<{ ok: boolean; data?: { diffLength: number }; error?: { code: string; message: string } }>
        status: () => Promise<{ ok: boolean; data?: { branch: string | null; upstream: string | null; ahead: number; behind: number; detached: boolean; merging: boolean; staged: { path: string; status: string; from?: string }[]; unstaged: { path: string; status: string; from?: string }[]; untracked: { path: string; status: string }[] }; error?: { code: string; message: string } }>
        diffFile: (path: string, staged?: boolean) => Promise<{ ok: boolean; data?: string; error?: { code: string; message: string } }>
        stage: (paths: string[]) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        unstage: (paths: string[]) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        discard: (paths: string[]) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        commit: (message: string) => Promise<{ ok: boolean; data?: { sha: string }; error?: { code: string; message: string } }>
        log: (params: { skip?: number; limit?: number; author?: string; grep?: string; path?: string }) => Promise<{ ok: boolean; data?: { sha: string; parents: string[]; authorName: string; authorEmail: string; date: string; subject: string }[]; error?: { code: string; message: string } }>
        commitDetails: (sha: string) => Promise<{ ok: boolean; data?: { sha: string; parents: string[]; authorName: string; authorEmail: string; date: string; subject: string; files: { path: string; status: string; from?: string }[] }; error?: { code: string; message: string } }>
        blame: (path: string, rev?: string) => Promise<{ ok: boolean; data?: { sha: string; author: string; content: string }[]; error?: { code: string; message: string } }>
        branches: () => Promise<{ ok: boolean; data?: { name: string; sha: string; head: boolean; upstream: string | null; ahead: number; behind: number }[]; error?: { code: string; message: string } }>
        branchCreate: (name: string, checkout?: boolean) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        switch: (name: string, force?: boolean) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        copyCommitPatch: (sha: string) => Promise<{ ok: boolean; data?: { length: number }; error?: { code: string; message: string } }>
        copyRangePrompt: (from: string | null, to: string, tokenBudget?: number) => Promise<{ ok: boolean; data?: { tokens: number }; error?: { code: string; message: string } }>
        showPatch: (sha: string, path?: string) => Promise<{ ok: boolean; data?: string; error?: { code: string; message: string } }>
      }
      patch: {
        apply: (patchText: string) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
      }
      search: {
        run: (
          query: string,
          options?: { regex?: boolean; caseSensitive?: boolean; word?: boolean; perFile?: number; maxResults?: number }
        ) => Promise<{ ok: boolean; data?: { path: string; line: number; preview: string; ranges: [number, number][] }[]; error?: { code: string; message: string } }>
      }
      terminal: {
        create: () => Promise<{ ok: boolean; data?: { id: string }; error?: { code: string; message: string } }>
        write: (id: string, data: string) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        resize: (id: string, cols: number, rows: number) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        kill: (id: string) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
        onData: (cb: (payload: { id: string; data: string }) => void) => () => void
        onExit: (cb: (payload: { id: string; exitCode?: number; signal?: number }) => void) => () => void
      }
    }
  }
}
