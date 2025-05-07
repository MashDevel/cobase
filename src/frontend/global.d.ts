export {};

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string[] | undefined>;
      onFilesInitial: (
        callback: (files: { fullPath: string; name: string }[]) => void
      ) => void;
      onFileAdded: (callback: (fullPath: string) => void) => void;
      onFileChanged: (callback: (fullPath: string) => void) => void;
      onFileRemoved: (callback: (fullPath: string) => void) => void;
      readTokens: (path: string) => Promise<any>;
      openFile: (path: string) => Promise<void>;
      copySelectedFiles: (
        paths: string[],
        includeTree: boolean,
        promptType: string,
        instructions: string
      ) => Promise<boolean>;
      openFolderDirect: (path: string) => Promise<string | null>;
    };
  }
}
