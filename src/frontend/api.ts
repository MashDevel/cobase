import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open } from '@tauri-apps/plugin-dialog'

type ApiError = { code: string; message: string }
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
type FilePayload = { fullPath: string; name: string; tokens?: number; lines?: number }

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

function onEvent<T>(event: string, cb: (payload: T) => void) {
  let dispose: null | (() => void) = null
  listen<T>(event, (evt) => cb(evt.payload))
    .then((unlisten) => {
      dispose = unlisten
    })
    .catch((error) => {
      console.error(`Failed to subscribe to ${event}`, error)
    })
  return () => {
    if (dispose) dispose()
  }
}

export function installApi() {
  window.api = {
    fs: {
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
  }
}
