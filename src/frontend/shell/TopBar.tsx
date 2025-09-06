import useShellStore from './store'
import { Command } from 'lucide-react'
import useExplorerStore from '../plugins/explorer/store'

export default function TopBar() {
  const setPaletteOpen = useShellStore(s => s.setPaletteOpen)
  const folderPath = useExplorerStore(s => s.folderPath)
  const selectFolder = useExplorerStore(s => s.selectFolder)

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
      <div className="flex items-center gap-2 no-drag">
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
