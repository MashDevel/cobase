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
      }
      patch: {
        apply: (patchText: string) => Promise<{ ok: boolean; data?: true; error?: { code: string; message: string } }>
      }
    }
  }
}
