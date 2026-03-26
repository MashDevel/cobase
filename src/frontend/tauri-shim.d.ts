declare module '@tauri-apps/api/core' {
  export function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}

declare module '@tauri-apps/api/event' {
  export type Event<T> = { payload: T }
  export function listen<T>(
    event: string,
    handler: (event: Event<T>) => void
  ): Promise<() => void>
}

declare module '@tauri-apps/plugin-dialog' {
  export function open(options: { directory?: boolean; multiple?: boolean }): Promise<string | string[] | null>
}

declare module '@tauri-apps/plugin-clipboard-manager' {
  export function writeText(text: string): Promise<void>
}
