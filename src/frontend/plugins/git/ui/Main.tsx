import { useEffect, useMemo, useState } from 'react'
import useGitStore from '../store'

function DiffBlock({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  return (
    <div className="text-xs font-mono border border-neutral-200 dark:border-neutral-700 rounded bg-neutral-50 dark:bg-neutral-800 overflow-auto">
      {lines.map((l, i) => {
        let cls = 'px-2 py-0.5 whitespace-pre-wrap'
        if (l.startsWith('+')) cls += ' text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
        else if (l.startsWith('-')) cls += ' text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
        else if (l.startsWith('@@')) cls += ' text-indigo-700 dark:text-indigo-400'
        else if (l.startsWith('diff --git') || l.startsWith('index ') || l.startsWith('--- ') || l.startsWith('+++ ')) cls += ' text-neutral-600 dark:text-neutral-300'
        else cls += ' text-neutral-800 dark:text-neutral-100'
        return <div key={i} className={cls}>{l}</div>
      })}
    </div>
  )
}

function ChangesView() {
  const s = useGitStore()
  const a = useGitStore(s => s.actions)
  const [err, setErr] = useState<string | null>(null)
  const [showBlame, setShowBlame] = useState(false)
  useEffect(() => { a.refresh() }, [])
  const staged = s.status?.staged || []
  const unstaged = s.status?.unstaged || []
  const untracked = s.status?.untracked || []
  const fileMap: Record<string, { path: string; status: string; staged: boolean; untracked?: boolean }> = {}
  for (const f of unstaged) fileMap[f.path] = { path: f.path, status: f.status, staged: false }
  for (const f of untracked) fileMap[f.path] = { path: f.path, status: 'U', staged: false, untracked: true }
  for (const f of staged) fileMap[f.path] = { path: f.path, status: f.status, staged: true }
  const files = Object.values(fileMap)
  const canCommit = (staged?.length || 0) > 0 && s.commitSummary.trim().length > 0
  const branchLabel = useMemo(() => {
    if (!s.status) return ''
    const b = s.status
    const tag = b.detached ? 'DETACHED' : (b.branch || '')
    const ab = b.upstream ? ` ${b.ahead > 0 ? `↑${b.ahead}` : ''}${b.behind > 0 ? ` ↓${b.behind}` : ''}` : ''
    return `${tag}${ab}`
  }, [s.status])
  return (
    <div className="h-full flex">
      <div className="w-full md:w-[380px] border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-w-[320px] max-w-[420px]">
        <div className="p-3 text-neutral-800 dark:text-neutral-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-neutral-700 dark:text-neutral-300">{branchLabel}</div>
            <div className="flex items-center gap-2">
              <button onClick={() => a.refresh()} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Refresh</button>
              <button onClick={async () => {
                const res = await window.api.git.copyDiff()
                if (!res.ok) setErr(res.error?.message || 'Failed')
                else setErr(null)
              }} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Copy Diff</button>
            </div>
          </div>
          {err && <div className="text-xs text-red-600 dark:text-red-400 mb-2">{err}</div>}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">Changed files</div>
            <div className="flex items-center gap-2">
              <button onClick={() => a.stageAll()} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs">Stage all</button>
              <button onClick={() => a.unstageAll()} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs">Unstage all</button>
            </div>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-700 rounded divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900 max-h-[50vh] overflow-auto">
            {files.length === 0 ? <div className="text-sm text-neutral-500 p-2">No changes</div> : files.map(f => (
              <div key={f.path} className="flex items-center gap-2 p-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!f.staged}
                  onChange={e => a.setFileStaged(f.path, e.target.checked)}
                />
                <button className="text-left flex-1 text-neutral-800 dark:text-neutral-200" onClick={() => a.selectPath(f.path, !!f.staged)}>{f.path}</button>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{f.untracked ? 'U' : f.status}</span>
                <button onClick={() => a.discardFile(f.path)} className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded text-[11px]">Discard</button>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto border-t border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Commit to {s.status?.branch || 'HEAD'}</div>
          <input value={s.commitSummary} onChange={e => a.setCommitSummary(e.target.value)} placeholder="Summary (required)" className="w-full border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 mb-2" />
          <textarea value={s.commitBody} onChange={e => a.setCommitBody(e.target.value)} placeholder="Description" className="w-full border border-neutral-300 dark:border-neutral-700 rounded p-2 h-20 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"></textarea>
          <div className="flex items-center gap-2 mt-2">
            <button disabled={!canCommit} onClick={async () => { const r = await a.commit(); if (!r.ok) setErr(r.message || 'Failed') }} className={`px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm ${canCommit ? '' : 'opacity-50 cursor-not-allowed'}`}>Commit</button>
          </div>
        </div>
      </div>
      <div className="flex-1 h-full overflow-auto p-3">
        {!s.selectedPath && <div className="text-sm text-neutral-500">Select a file to preview diff</div>}
        {s.selectedPath && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-mono text-neutral-700 dark:text-neutral-300">{s.selectedPath}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowBlame(false) }} className={`px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs ${!showBlame ? '' : 'opacity-60'}`}>Diff</button>
                <button onClick={async () => { setShowBlame(true); await a.fetchBlame(undefined) }} className={`px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs ${showBlame ? '' : 'opacity-60'}`}>Blame</button>
              </div>
            </div>
            {!showBlame && <DiffBlock text={s.diff || ''} />}
            {showBlame && (
              <div className="text-xs font-mono bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 p-2 rounded border border-neutral-200 dark:border-neutral-700">
                {(s.blame || []).map((l, i) => (
                  <div key={i} className="flex gap-2"><span className="text-neutral-500 dark:text-neutral-400 w-20 shrink-0">{l.sha.slice(0,7)}</span><span className="text-neutral-600 dark:text-neutral-300 w-28 truncate shrink-0">{l.author}</span><span className="flex-1 whitespace-pre-wrap">{l.content}</span></div>
                ))}
                {(!s.blame || s.blame.length === 0) && <div className="text-neutral-500">No blame data</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryView() {
  const s = useGitStore()
  const a = useGitStore(s => s.actions)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { a.loadHistory() }, [s.historySkip, s.historyFilters.author, s.historyFilters.grep, s.historyFilters.path])
  return (
    <div className="h-full flex">
      <div className="w-full md:w-[360px] border-r border-neutral-200 dark:border-neutral-800 p-3 overflow-auto text-neutral-800 dark:text-neutral-200 min-w-[300px] max-w-[420px]">
        <div className="flex items-end gap-2 mb-3">
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Author</label>
            <input value={s.historyFilters.author} onChange={e => a.setHistoryFilter('author', e.target.value)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Message</label>
            <input value={s.historyFilters.grep} onChange={e => a.setHistoryFilter('grep', e.target.value)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-neutral-500">Path</label>
            <input value={s.historyFilters.path} onChange={e => a.setHistoryFilter('path', e.target.value)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
          </div>
          <button onClick={() => a.loadHistory()} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Apply</button>
        </div>
        <div className="border border-neutral-200 dark:border-neutral-700 rounded divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
          {s.history.length === 0 ? <div className="text-sm text-neutral-500 p-2">No commits</div> : s.history.map(c => (
            <div key={c.sha} className="p-2 text-sm flex items-center justify-between">
              <button className="text-left text-neutral-800 dark:text-neutral-200" onClick={() => a.selectCommit(c.sha)}>
                <div className="font-medium">{c.subject}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{c.sha.slice(0,7)} · {c.authorName} · {new Date(c.date).toLocaleString()}</div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={async () => { const r = await a.copyCommitPatch(c.sha); if (!r.ok) setErr(r.message || 'Failed') }} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-xs">Copy Patch</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button onClick={() => a.pageHistory(-1)} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Prev</button>
          <button onClick={() => a.pageHistory(1)} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Next</button>
        </div>
        {err && <div className="text-xs text-red-600 dark:text-red-400 mt-2">{err}</div>}
        <div className="mt-4">
          <RangeCopy />
        </div>
      </div>
      <div className="flex-1 h-full overflow-auto p-3">
        {!s.commitDetails && <div className="text-sm text-neutral-500 dark:text-neutral-400">Select a commit to view details</div>}
        {s.commitDetails && (
          <div className="text-sm text-neutral-800 dark:text-neutral-200">
            <div className="font-medium mb-1">{s.commitDetails.subject}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">{s.commitDetails.sha} · {s.commitDetails.authorName} · {new Date(s.commitDetails.date).toLocaleString()}</div>
            <div className="flex items-start gap-3">
              <div className="w-[280px] min-w-[220px] max-w-[360px]">
                <div className="font-semibold text-sm mb-1">Files</div>
                <div className="border border-neutral-200 dark:border-neutral-700 rounded divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
                  {s.commitDetails.files.map(f => (
                    <button key={f.path} className={`w-full text-left p-2 text-xs ${s.commitSelectedFile === f.path ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`} onClick={() => a.selectCommitFile(f.path)}>
                      <div className="flex items-center justify-between">
                        <div className="text-neutral-800 dark:text-neutral-200 truncate">{f.path}</div>
                        <div className="text-neutral-500 dark:text-neutral-400 ml-2 shrink-0">{f.status}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs font-mono mb-2 text-neutral-600 dark:text-neutral-300">{s.commitSelectedFile || 'Full patch'}</div>
                <DiffBlock text={s.commitPatch || ''} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RangeCopy() {
  const a = useGitStore(s => s.actions)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [budget, setBudget] = useState<number>(8000)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded p-2 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
      <div className="font-semibold text-sm mb-2">Copy Range as Prompt</div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <input placeholder="From (optional)" value={from} onChange={e => setFrom(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
        <input placeholder="To" value={to} onChange={e => setTo(e.target.value)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
        <input type="number" placeholder="Token budget" value={budget} onChange={e => setBudget(parseInt(e.target.value || '0', 10) || 0)} className="border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={async () => { const r = await a.copyRangePrompt(from || null, to, budget); setMsg(r.ok ? 'Copied' : r.message || 'Failed') }} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Copy</button>
        {msg && <div className="text-xs text-neutral-500 dark:text-neutral-400">{msg}</div>}
      </div>
    </div>
  )
}

export default function Main() {
  const s = useGitStore()
  const a = useGitStore(s => s.actions)
  useEffect(() => { a.refresh() }, [])
  return (
    <div className="h-full flex flex-col">
      <div className="px-3 pt-3">
        <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800 rounded text-neutral-800 dark:text-neutral-200">
          <button onClick={() => a.setTab('changes')} className={`px-3 py-1.5 text-sm rounded ${s.selectedTab === 'changes' ? 'bg-white dark:bg-neutral-700' : ''}`}>Changes</button>
          <button onClick={() => a.setTab('history')} className={`px-3 py-1.5 text-sm rounded ${s.selectedTab === 'history' ? 'bg-white dark:bg-neutral-700' : ''}`}>History</button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {s.selectedTab === 'changes' && <ChangesView />}
        {s.selectedTab === 'history' && <HistoryView />}
      </div>
    </div>
  )
}
