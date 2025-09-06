import { ipcMain, clipboard } from 'electron'
import { execSync } from 'child_process'

export function registerGit(ctx) {
  function runGit(cmd) {
    const cwd = ctx.getOpenedFolderPath()
    if (!cwd) throw new Error('No folder is currently opened')
    try {
      const out = execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
      return { ok: true, out }
    } catch (e) {
      if (e?.stdout) return { ok: true, out: e.stdout.toString() }
      const msg = e?.stderr?.toString() || e?.message || 'Git command failed'
      return { ok: false, error: msg }
    }
  }

  function parseNameStatus(text) {
    const lines = text.split('\n').filter(Boolean)
    const files = []
    for (const line of lines) {
      const parts = line.split('\t')
      const code = parts[0]
      if (!code) continue
      if (code.startsWith('R')) {
        const from = parts[1]
        const to = parts[2]
        files.push({ path: to, status: 'R', from })
      } else if (code.startsWith('C')) {
        const from = parts[1]
        const to = parts[2]
        files.push({ path: to, status: 'C', from })
      } else {
        const p = parts[1]
        files.push({ path: p, status: code })
      }
    }
    return files
  }

  ipcMain.handle('git:copyDiff', async () => {
    try {
      const cwd = ctx.getOpenedFolderPath()
      if (!cwd) throw new Error('No folder is currently opened')
      let trackedDiff = ''
      try {
        trackedDiff = execSync('git diff', { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      } catch (e) {
        if (e?.stdout) trackedDiff = e.stdout.toString(); else throw e
      }
      const untrackedFiles = execSync('git ls-files --others --exclude-standard', { cwd, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
      let untrackedDiff = ''
      for (const file of untrackedFiles) {
        try {
          untrackedDiff += execSync(`git diff --no-index -- /dev/null "${file}"`, { cwd, encoding: 'utf8' })
        } catch (e) {
          if (e?.stdout) untrackedDiff += e.stdout.toString(); else throw e
        }
      }
      const diff = trackedDiff + untrackedDiff
      if (!diff.trim()) throw new Error('Working tree is clean – nothing to diff')
      clipboard.writeText(diff)
      return { success: true, diffLength: diff.length }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:status', async () => {
    try {
      const branchInfo = runGit('git status --porcelain=2 --branch')
      if (!branchInfo.ok) throw new Error(branchInfo.error)
      let branch = null
      let upstream = null
      let ahead = 0
      let behind = 0
      let detached = false
      let merging = false
      for (const line of branchInfo.out.split('\n')) {
        if (line.startsWith('# branch.head')) {
          const v = line.split(' ')[2]
          if (v === '(detached)') detached = true; else branch = v
        } else if (line.startsWith('# branch.upstream')) {
          upstream = line.split(' ')[2] || null
        } else if (line.startsWith('# branch.ab')) {
          const parts = line.split(' ')
          const ab = parts[2] || ''
          const m = /\+([0-9]+) -([0-9]+)/.exec(ab)
          if (m) { ahead = parseInt(m[1] || '0', 10); behind = parseInt(m[2] || '0', 10) }
        }
      }
      try {
        const rebase = runGit('git rev-parse -q --verify REBASE_HEAD')
        if (rebase.ok && rebase.out.trim()) merging = true
      } catch {}
      try {
        const merge = runGit('git rev-parse -q --verify MERGE_HEAD')
        if (merge.ok && merge.out.trim()) merging = true
      } catch {}
      const stagedRaw = runGit('git diff --name-status --cached')
      if (!stagedRaw.ok) throw new Error(stagedRaw.error)
      const unstagedRaw = runGit('git diff --name-status')
      if (!unstagedRaw.ok) throw new Error(unstagedRaw.error)
      const untrackedRaw = runGit('git ls-files --others --exclude-standard')
      if (!untrackedRaw.ok) throw new Error(untrackedRaw.error)
      const staged = parseNameStatus(stagedRaw.out)
      const unstaged = parseNameStatus(unstagedRaw.out)
      const untracked = untrackedRaw.out.split('\n').filter(Boolean).map(p => ({ path: p, status: 'U' }))
      return { success: true, data: { branch, upstream, ahead, behind, detached, merging, staged, unstaged, untracked } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:diffFile', async (_e, payload) => {
    try {
      const { path: filePath, staged } = payload || {}
      if (!filePath) throw new Error('Missing path')
      const cmd = staged ? `git diff --cached -- "${filePath}"` : `git diff -- "${filePath}"`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      if (!res.out.trim()) {
        const untracked = runGit('git ls-files --others --exclude-standard')
        if (untracked.ok && untracked.out.split('\n').filter(Boolean).includes(filePath)) {
          const d = runGit(`git diff --no-index -- /dev/null "${filePath}"`)
          if (!d.ok) throw new Error(d.error)
          return { success: true, data: d.out }
        }
      }
      return { success: true, data: res.out }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:stage', async (_e, paths) => {
    try {
      if (!Array.isArray(paths) || paths.length === 0) throw new Error('No paths')
      const cmd = `git add -A -- ${paths.map(p => `"${p}"`).join(' ')}`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:unstage', async (_e, paths) => {
    try {
      if (!Array.isArray(paths) || paths.length === 0) throw new Error('No paths')
      const cmd = `git restore --staged -- ${paths.map(p => `"${p}"`).join(' ')}`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:discard', async (_e, paths) => {
    try {
      if (!Array.isArray(paths) || paths.length === 0) throw new Error('No paths')
      const tracked = runGit('git ls-files')
      if (!tracked.ok) throw new Error(tracked.error)
      const trackedSet = new Set(tracked.out.split('\n').filter(Boolean))
      const trackedPaths = paths.filter(p => trackedSet.has(p))
      const untrackedPaths = paths.filter(p => !trackedSet.has(p))
      if (trackedPaths.length) {
        const r = runGit(`git restore --worktree -- ${trackedPaths.map(p => `"${p}"`).join(' ')}`)
        if (!r.ok) throw new Error(r.error)
      }
      if (untrackedPaths.length) {
        const c = runGit(`git clean -f -- ${untrackedPaths.map(p => `"${p}"`).join(' ')}`)
        if (!c.ok) throw new Error(c.error)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:commit', async (_e, payload) => {
    try {
      const { message } = payload || {}
      if (!message || !message.trim()) throw new Error('Commit message required')
      const res = runGit(`git commit -m ${JSON.stringify(message)}`)
      if (!res.ok) throw new Error(res.error)
      const sha = runGit('git rev-parse HEAD')
      const out = sha.ok ? sha.out.trim() : ''
      return { success: true, data: { sha: out } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:log', async (_e, payload) => {
    try {
      const { skip = 0, limit = 50, author, grep, path: onlyPath } = payload || {}
      const args = ['git', 'log', `--skip=${skip}`, '-n', String(limit), '--date=iso', '--pretty=format:%H\x1f%P\x1f%an\x1f%ae\x1f%ad\x1f%s\x1e']
      if (author) args.push(`--author=${author}`)
      if (grep) args.push(`--grep=${grep}`)
      if (onlyPath) args.push('--', onlyPath)
      const res = runGit(args.join(' '))
      if (!res.ok) throw new Error(res.error)
      const entries = res.out.split('\x1e').filter(Boolean).map(s => s.split('\x1f'))
      const commits = entries.map(parts => ({ sha: parts[0], parents: (parts[1] || '').split(' ').filter(Boolean), authorName: parts[2], authorEmail: parts[3], date: parts[4], subject: parts[5] }))
      return { success: true, data: commits }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:commitDetails', async (_e, sha) => {
    try {
      if (!sha) throw new Error('Missing sha')
      const meta = runGit(`git show -s --format=%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s --date=iso ${sha}`)
      if (!meta.ok) throw new Error(meta.error)
      const parts = meta.out.trim().split('\x1f')
      const nameStatus = runGit(`git show --name-status --pretty=format: --no-color ${sha}`)
      if (!nameStatus.ok) throw new Error(nameStatus.error)
      const files = parseNameStatus(nameStatus.out)
      const data = { sha: parts[0], parents: (parts[1] || '').split(' ').filter(Boolean), authorName: parts[2], authorEmail: parts[3], date: parts[4], subject: parts[5], files }
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:blame', async (_e, payload) => {
    try {
      const { path: filePath, rev } = payload || {}
      if (!filePath) throw new Error('Missing path')
      const cmd = rev ? `git blame -p ${rev} -- "${filePath}"` : `git blame -p -- "${filePath}"`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      const lines = res.out.split('\n')
      const result = []
      let i = 0
      while (i < lines.length) {
        const header = lines[i++]
        if (!header) break
        const hParts = header.split(' ')
        const sha = hParts[0]
        let author = ''
        let content = ''
        while (i < lines.length) {
          const l = lines[i++]
          if (!l) break
          if (l.startsWith('author ')) author = l.slice(7)
          if (l.startsWith('\t')) { content = l.slice(1); break }
          if (l.startsWith('filename ')) {}
        }
        result.push({ sha, author, content })
      }
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:branches', async () => {
    try {
      const locals = runGit("git for-each-ref --format='%(HEAD)%00%(refname:short)%00%(objectname)%00%(upstream:short)%00%(upstream:trackshort)' refs/heads")
      if (!locals.ok) throw new Error(locals.error)
      const rows = locals.out.split('\n').filter(Boolean)
      const branches = rows.map(r => {
        const parts = r.replace(/^'|'$/g, '').split('\x00')
        const head = parts[0] === '*'
        const name = parts[1] || ''
        const sha = parts[2] || ''
        const upstream = parts[3] || null
        const track = parts[4] || ''
        let ahead = 0
        let behind = 0
        const m1 = /ahead ([0-9]+)/.exec(track || '')
        const m2 = /behind ([0-9]+)/.exec(track || '')
        if (m1) ahead = parseInt(m1[1] || '0', 10)
        if (m2) behind = parseInt(m2[1] || '0', 10)
        return { name, sha, head, upstream, ahead, behind }
      })
      return { success: true, data: branches }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:branchCreate', async (_e, payload) => {
    try {
      const { name, checkout } = payload || {}
      if (!name || !name.trim()) throw new Error('Branch name required')
      const cmd = checkout ? `git switch -c ${JSON.stringify(name)}` : `git branch ${JSON.stringify(name)}`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:switch', async (_e, payload) => {
    try {
      const { name, force } = payload || {}
      if (!name) throw new Error('Branch name required')
      if (!force) {
        const dirty = runGit('git status --porcelain')
        if (!dirty.ok) throw new Error(dirty.error)
        if (dirty.out.trim()) return { success: false, error: 'Working tree has uncommitted changes', code: 'DIRTY' }
      }
      const res = runGit(`git switch ${JSON.stringify(name)}`)
      if (!res.ok) throw new Error(res.error)
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('git:copyCommitPatch', async (_e, sha) => {
    try {
      if (!sha) throw new Error('Missing sha')
      const res = runGit(`git format-patch -1 --stdout ${sha}`)
      if (!res.ok) throw new Error(res.error)
      clipboard.writeText(res.out)
      return { success: true, data: { length: res.out.length } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:copyRangePrompt', async (_e, payload) => {
    try {
      const { from, to, tokenBudget = 16000 } = payload || {}
      if (!to) throw new Error('Missing range')
      const range = from ? `${from}..${to}` : to
      const list = runGit(`git log --reverse --pretty=format:%H%x1f%an%x1f%ad%x1f%s --date=iso ${range}`)
      if (!list.ok) throw new Error(list.error)
      const lines = list.out.split('\n').filter(Boolean)
      const shas = lines.map(l => l.split('\x1f')[0])
      let parts = []
      for (const sha of shas) {
        const meta = runGit(`git show -s --format=%H%x1f%an%x1f%ad%x1f%s --date=iso ${sha}`)
        if (!meta.ok) continue
        const m = meta.out.trim().split('\x1f')
        const patch = runGit(`git format-patch -1 --stdout ${sha}`)
        if (!patch.ok) continue
        parts.push(`Commit ${m[0]}\nAuthor: ${m[1]}\nDate: ${m[2]}\nSubject: ${m[3]}\n\n${patch.out}\n`)
      }
      let text = parts.join('\n')
      let tokens = 0
      try { tokens = ctx.encoder.encode(text).length } catch { tokens = Math.ceil(text.length / 4) }
      if (tokens > tokenBudget) {
        let low = 0
        let high = text.length
        let best = 0
        while (low <= high) {
          const mid = Math.floor((low + high) / 2)
          const slice = text.slice(0, mid)
          let t = 0
          try { t = ctx.encoder.encode(slice).length } catch { t = Math.ceil(slice.length / 4) }
          if (t <= tokenBudget) { best = mid; low = mid + 1 } else { high = mid - 1 }
        }
        text = text.slice(0, best) + '\n\n[Truncated due to token budget]'
      }
      clipboard.writeText(text)
      return { success: true, data: { tokens: tokenBudget } }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('git:showPatch', async (_e, payload) => {
    try {
      const { sha, path: onlyPath } = payload || {}
      if (!sha) throw new Error('Missing sha')
      const cmd = onlyPath ? `git show --patch --no-color --pretty=format: ${sha} -- "${onlyPath}"` : `git show --patch --no-color --pretty=format: ${sha}`
      const res = runGit(cmd)
      if (!res.ok) throw new Error(res.error)
      return { success: true, data: res.out }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

