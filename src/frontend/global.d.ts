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
  }
}
