import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open } from '@tauri-apps/plugin-dialog'

type ApiError = { code: string; message: string }
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
type FilePayload = { fullPath: string; name: string; tokens?: number; lines?: number }
type TextFilePayload = { path: string; content: string }
type TerminalDataPayload = { sessionId: string; data: string }
type TerminalExitPayload = { sessionId: string; code?: number | null }

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const err = <T>(code: string, message: string): ApiResult<T> => ({ ok: false, error: { code, message } })

async function run<T>(command: string, args: Record<string, unknown>, code: string): Promise<ApiResult<T>> {
  try {
    return ok(await invoke<T>(command, args))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(code, message)
  }
}

async function onEvent<T>(event: string, cb: (payload: T) => void) {
  let dispose: null | (() => void) = null
  try {
    dispose = await listen<T>(event, (evt) => cb(evt.payload))
  } catch (error) {
    console.error(`Failed to subscribe to ${event}`, error)
  }
  return () => {
    if (dispose) dispose()
  }
}

export function installApi() {
  window.api = {
    fs: {
      getOpenedFolder: async () => run<string | null>('get_opened_folder', {}, 'OPEN_FAILED'),
      selectFolder: async () => {
        try {
          const selected = await open({ directory: true, multiple: false })
          const selectedPath = Array.isArray(selected) ? selected[0] : selected
          if (!selectedPath) return ok<string | undefined>(undefined)
          const opened = await run<string>('open_folder', { path: selectedPath }, 'OPEN_FAILED')
          if (!opened.ok) return opened
          return ok(opened.data)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return err('OPEN_FAILED', message)
        }
      },
      openFolderDirect: async (path) => run<string>('open_folder', { path }, 'OPEN_FAILED'),
      estimateTokens: async (path) => run<number>('estimate_tokens', { path }, 'ESTIMATE_TOKENS_FAILED'),
      estimateLines: async (path) => run<number>('estimate_lines', { path }, 'ESTIMATE_LINES_FAILED'),
      readTextFile: async (path) => run<TextFilePayload>('read_text_file', { path }, 'READ_FILE_FAILED'),
      writeTextFile: async (path, content) => run<TextFilePayload>('write_text_file', { path, content }, 'WRITE_FILE_FAILED'),
      revealPathInSystem: async (path) => run<true>('reveal_path_in_system', { path }, 'REVEAL_PATH_FAILED'),
      openPathInSystem: async (path) => run<true>('open_path_in_system', { path }, 'OPEN_PATH_FAILED'),
      renamePath: async (path, newName) => run<{ path: string }>('rename_path', { path, newName }, 'RENAME_PATH_FAILED'),
      deletePath: async (path) => run<true>('delete_path', { path }, 'DELETE_PATH_FAILED'),
      copyPathTo: async (path, destinationDir) => run<{ path: string }>('copy_path_to', { path, destinationDir }, 'COPY_PATH_FAILED'),
      movePathTo: async (path, destinationDir) => run<{ path: string }>('move_path_to', { path, destinationDir }, 'MOVE_PATH_FAILED'),
      onFilesInitial: (cb) => onEvent<FilePayload[]>('files:initial', cb),
      onFileAdded: (cb) => onEvent<string>('file-added', cb),
      onFileChanged: (cb) => onEvent<string>('file-changed', cb),
      onFileRemoved: (cb) => onEvent<string>('file-removed', cb),
      copySelectedFiles: async (paths, includeTree, promptType, instructions) => {
        const result = await run<string>(
          'copy_selected_files_text',
          { paths, includeTree, promptType, instructions },
          'COPY_SELECTED_FAILED'
        )
        if (!result.ok) return result
        try {
          await writeText(result.data)
          return ok(true as const)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return err('COPY_SELECTED_FAILED', message)
        }
      },
    },
    git: {
      copyDiff: async () => {
        const result = await run<{ diff: string; diffLength: number }>('git_copy_diff_text', {}, 'COPY_DIFF_FAILED')
        if (!result.ok) return result
        try {
          await writeText(result.data.diff)
          return ok({ diffLength: result.data.diffLength })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return err('COPY_DIFF_FAILED', message)
        }
      },
      status: async () => run('git_status', {}, 'STATUS_FAILED'),
      diffFile: async (path, staged) => run<string>('git_diff_file', { path, staged: !!staged }, 'DIFF_FAILED'),
      stage: async (paths) => run<true>('git_stage', { paths }, 'STAGE_FAILED'),
      unstage: async (paths) => run<true>('git_unstage', { paths }, 'UNSTAGE_FAILED'),
      discard: async (paths) => run<true>('git_discard', { paths }, 'DISCARD_FAILED'),
      commit: async (message) => run<{ sha: string }>('git_commit', { message }, 'COMMIT_FAILED'),
      log: async (params) => run('git_log', { payload: params }, 'LOG_FAILED'),
      commitDetails: async (sha) => run('git_commit_details', { sha }, 'COMMIT_DETAILS_FAILED'),
      blame: async (path, rev) => run('git_blame', { path, rev }, 'BLAME_FAILED'),
      branches: async () => run('git_branches', {}, 'BRANCHES_FAILED'),
      branchCreate: async (name, checkout) => run<true>('git_branch_create', { name, checkout: !!checkout }, 'BRANCH_CREATE_FAILED'),
      switch: async (name, force) => run<true>('git_switch_branch', { name, force: !!force }, 'SWITCH_FAILED'),
      copyCommitPatch: async (sha) => {
        const result = await run<{ text: string; length: number }>('git_copy_commit_patch_text', { sha }, 'COPY_COMMIT_PATCH_FAILED')
        if (!result.ok) return result
        try {
          await writeText(result.data.text)
          return ok({ length: result.data.length })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return err('COPY_COMMIT_PATCH_FAILED', message)
        }
      },
      copyRangePrompt: async (from, to, tokenBudget) => {
        const result = await run<{ text: string; tokens: number }>(
          'git_copy_range_prompt_text',
          { from, to, tokenBudget: tokenBudget ?? 16000 },
          'COPY_RANGE_PROMPT_FAILED'
        )
        if (!result.ok) return result
        try {
          await writeText(result.data.text)
          return ok({ tokens: result.data.tokens })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return err('COPY_RANGE_PROMPT_FAILED', message)
        }
      },
      showPatch: async (sha, path) => run<string>('git_show_patch', { sha, path }, 'SHOW_PATCH_FAILED'),
    },
    patch: {
      apply: async (patchText) => run<true>('apply_patch_text', { patchText }, 'PATCH_FAILED'),
    },
    search: {
      run: async (query, options) => run('search_run', { payload: { query, ...(options || {}) } }, 'SEARCH_FAILED'),
    },
    terminal: {
      start: async (cwd) => run<string>('terminal_start', { cwd }, 'TERMINAL_START_FAILED'),
      write: async (sessionId, data) => run<true>('terminal_write', { sessionId, data }, 'TERMINAL_WRITE_FAILED'),
      resize: async (sessionId, cols, rows) => run<true>('terminal_resize', { sessionId, cols, rows }, 'TERMINAL_RESIZE_FAILED'),
      close: async (sessionId) => run<true>('terminal_close', { sessionId }, 'TERMINAL_CLOSE_FAILED'),
      onData: (cb) => onEvent<TerminalDataPayload>('terminal:data', cb),
      onExit: (cb) => onEvent<TerminalExitPayload>('terminal:exit', cb),
    },
  }
}
