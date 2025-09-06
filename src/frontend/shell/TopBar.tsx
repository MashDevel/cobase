import { useEffect, useState } from 'react'
import useShellStore from './store'
import { Command, GitBranch } from 'lucide-react'
import useExplorerStore from '../plugins/explorer/store'
import useGitStore from '../plugins/git/store'

export default function TopBar() {
  const setPaletteOpen = useShellStore(s => s.setPaletteOpen)
  const folderPath = useExplorerStore(s => s.folderPath)
  const selectFolder = useExplorerStore(s => s.selectFolder)
  const git = useGitStore()
  const ga = useGitStore(s => s.actions)
  const [open, setOpen] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  useEffect(() => { if (open) { ga.loadBranches(); ga.refresh() } }, [open])

  return (
    <div className="h-10 border-b bg-white dark:bg-neutral-900 flex items-center justify-between px-3 py-2 drag-region mx-2 titlebar-safe-left">
      <div className="no-drag">
        <button
          onClick={selectFolder}
          className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm font-mono text-neutral-800 dark:text-neutral-100 cursor-pointer hover:underline"
        >
          {folderPath?.split('/').filter(Boolean).pop() ?? 'Open Folder'}
        </button>
      </div>
      <div className="flex items-center gap-2 no-drag relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center gap-2"
        >
          <GitBranch className="h-4 w-4" />
          {git.status?.branch || (git.status?.detached ? 'DETACHED' : 'Branch')}
        </button>
        {open && (
          <div className="absolute top-9 right-28 z-20 w-72 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded shadow">
            <div className="p-2 text-xs text-neutral-500 dark:text-neutral-400">Switch Branch</div>
            <div className="max-h-60 overflow-auto divide-y divide-neutral-200 dark:divide-neutral-800">
              {git.branches.map(b => (
                <button key={b.name} onClick={async () => { await ga.switchBranch(b.name); setOpen(false) }} className={`w-full text-left px-3 py-2 text-sm ${b.head ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-neutral-800 dark:text-neutral-200">{b.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">{b.upstream || ''}</div>
                  </div>
                </button>
              ))}
              {git.branches.length === 0 && <div className="px-3 py-2 text-sm text-neutral-500">No branches</div>}
            </div>
            <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <input value={newBranch} onChange={e => setNewBranch(e.target.value)} placeholder="New branch" className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200" />
                <button onClick={async () => { if (newBranch.trim()) { await ga.createBranch(newBranch.trim(), true); setNewBranch(''); setOpen(false) } }} className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm">Create</button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setPaletteOpen(true)}
          className="px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 flex items-center gap-2"
        >
          <Command className="h-4 w-4" />
          Command Palette
        </button>
      </div>
    </div>
  )
}
