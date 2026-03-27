import { useEffect, useState } from 'react'
import useShellStore from './store'
import { Command, GitBranch } from 'lucide-react'
import useExplorerStore from '../plugins/explorer/store'
import useGitStore from '../plugins/git/store'

export default function TopBar() {
  const setPaletteOpen = useShellStore(s => s.setPaletteOpen)
  const folderPath = useExplorerStore(s => s.folderPath)
  const selectFolder = useExplorerStore(s => s.selectFolder)
  const branch = useGitStore((state) => state.status?.branch || null)
  const detached = useGitStore((state) => state.status?.detached || false)
  const branches = useGitStore((state) => state.branches)
  const loadBranches = useGitStore((state) => state.actions.loadBranches)
  const refresh = useGitStore((state) => state.actions.refresh)
  const switchBranch = useGitStore((state) => state.actions.switchBranch)
  const createBranch = useGitStore((state) => state.actions.createBranch)
  const [open, setOpen] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  useEffect(() => { if (open) { void loadBranches(); void refresh() } }, [loadBranches, open, refresh])

  return (
    <div className="h-8 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 flex items-center justify-between px-2 drag-region titlebar-safe-left" data-tauri-drag-region>
      <div className="no-drag">
        <button
          onClick={selectFolder}
          className="h-6 max-w-56 px-2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[12px] font-mono text-neutral-800 dark:text-neutral-100 cursor-pointer truncate"
        >
          {folderPath?.split('/').filter(Boolean).pop() ?? 'Open Folder'}
        </button>
      </div>
      <div className="flex items-center gap-2 no-drag relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="h-6 px-2 text-[12px] border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5"
        >
          <GitBranch className="h-3.5 w-3.5" />
          {branch || (detached ? 'DETACHED' : 'Branch')}
        </button>
        {open && (
          <div className="absolute top-7 right-24 z-20 w-72 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-md shadow">
            <div className="p-2 text-xs text-neutral-500 dark:text-neutral-400">Switch Branch</div>
            <div className="max-h-60 overflow-auto divide-y divide-neutral-200 dark:divide-neutral-800">
              {branches.map(b => (
                <button key={b.name} onClick={async () => { await switchBranch(b.name); setOpen(false) }} className={`w-full text-left px-3 py-2 text-sm ${b.head ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-neutral-800 dark:text-neutral-200">{b.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{b.upstream || ''}</div>
                  </div>
                </button>
              ))}
              {branches.length === 0 && <div className="px-3 py-2 text-sm text-neutral-500">No branches</div>}
            </div>
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <input value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="New branch" className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
                <button onClick={async () => { if (newBranch.trim()) { await createBranch(newBranch.trim(), true); setNewBranch(''); setOpen(false) } }} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Create</button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setPaletteOpen(true)}
          className="h-6 px-2 text-[12px] border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5"
        >
          <Command className="h-3.5 w-3.5" />
          Command Palette
        </button>
      </div>
    </div>
  )
}
