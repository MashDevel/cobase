import { useEffect, useMemo, useRef, useState } from 'react'
import useExplorerStore from '../../explorer/store'
import useSearchStore from '../store'
import { Search, CaseSensitive, Regex, WholeWord } from './icons'

function Toggle({ active, onToggle, children }: { active: boolean; onToggle: () => void; children: React.ReactNode }) {
  const cls = `px-2 py-1 text-xs border rounded ${active ? 'bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100' : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`
  return (
    <button onClick={onToggle} className={cls}>{children}</button>
  )
}

function MatchLine({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts = [] as React.ReactNode[]
  let idx = 0
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  for (const [s, e] of sorted) {
    if (s > idx) parts.push(<span key={idx + 'n'}>{text.slice(idx, s)}</span>)
    parts.push(<span key={s + '-' + e} className="bg-yellow-200 dark:bg-yellow-800">{text.slice(s, e)}</span>)
    idx = e
  }
  if (idx < text.length) parts.push(<span key={idx + 't'}>{text.slice(idx)}</span>)
  return <div className="whitespace-pre-wrap break-words">{parts}</div>
}

export default function Main() {
  const folderPath = useExplorerStore(s => s.folderPath)
  const selectFolder = useExplorerStore(s => s.selectFolder)
  const q = useSearchStore(s => s.query)
  const regex = useSearchStore(s => s.regex)
  const cs = useSearchStore(s => s.caseSensitive)
  const word = useSearchStore(s => s.word)
  const perFile = useSearchStore(s => s.perFile)
  const maxResults = useSearchStore(s => s.maxResults)
  const searching = useSearchStore(s => s.searching)
  const err = useSearchStore(s => s.error)
  const res = useSearchStore(s => s.results)
  const setQuery = useSearchStore(s => s.setQuery)
  const setRegex = useSearchStore(s => s.setRegex)
  const setCs = useSearchStore(s => s.setCaseSensitive)
  const setWord = useSearchStore(s => s.setWord)
  const setPerFile = useSearchStore(s => s.setPerFile)
  const setMaxResults = useSearchStore(s => s.setMaxResults)
  const run = useSearchStore(s => s.run)
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (folderPath && inputRef.current) inputRef.current.focus() }, [folderPath])
  const [localPerFile, setLocalPerFile] = useState(perFile)
  const [localMax, setLocalMax] = useState(maxResults)
  useEffect(() => setLocalPerFile(perFile), [perFile])
  useEffect(() => setLocalMax(maxResults), [maxResults])
  const summary = useMemo(() => `${res.length} result${res.length === 1 ? '' : 's'}`, [res.length])
  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col">
      {!folderPath ? (
        <div className="flex-1 flex items-center justify-center">
          <button onClick={selectFolder} className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded">Open Folder</button>
        </div>
      ) : (
        <>
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full px-9 py-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm"
                  placeholder="Search in files"
                  value={q}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') run() }}
                />
              </div>
              <Toggle active={regex} onToggle={() => setRegex(!regex)}><div className="flex items-center gap-1"><Regex /><span>Regex</span></div></Toggle>
              <Toggle active={cs} onToggle={() => setCs(!cs)}><div className="flex items-center gap-1"><CaseSensitive /><span>Case</span></div></Toggle>
              <Toggle active={word} onToggle={() => setWord(!word)}><div className="flex items-center gap-1"><WholeWord /><span>Word</span></div></Toggle>
              <button disabled={searching} onClick={() => run()} className={`px-3 py-2 text-sm border rounded ${searching ? 'opacity-60 cursor-not-allowed' : ''} border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100`}>{searching ? 'Searching…' : 'Search'}</button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-1">
                <span>Per file</span>
                <input type="number" min={1} max={1000} value={localPerFile} onChange={e => setLocalPerFile(parseInt(e.target.value || '1', 10) || 1)} onBlur={() => setPerFile(localPerFile)} className="w-20 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
              </div>
              <div className="flex items-center gap-1">
                <span>Max</span>
                <input type="number" min={1} max={10000} value={localMax} onChange={e => setLocalMax(parseInt(e.target.value || '1', 10) || 1)} onBlur={() => setMaxResults(localMax)} className="w-24 px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100" />
              </div>
              <div>{summary}</div>
              {err && <div className="text-red-600 dark:text-red-400">{err}</div>}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {res.length === 0 && q && !searching && <div className="text-sm text-neutral-500 dark:text-neutral-400">No results</div>}
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {res.map((r, i) => (
                <div key={i} className="py-2">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">{r.path}:{r.line}</div>
                  <div className="text-sm text-neutral-900 dark:text-neutral-100 font-mono">
                    <MatchLine text={r.preview} ranges={r.ranges} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

