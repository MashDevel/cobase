import useStore from '../store'
import Directory from './parts/Directory'
import { buildTree } from '../services/tree'
import FileItem from './parts/FileItem'
import { Search, X, Copy } from 'lucide-react'
import { useMemo } from 'react'
import useResizable from '../../../hooks/useResizable'
import { useNotify } from '../../../hooks/useNotify'
import Notify from '../../../components/Notify'

export default function Sidebar() {
  const files = useStore(s => s.files)
  const selected = useStore(s => s.selected)
  const search = useStore(s => s.search)
  const folderPath = useStore(s => s.folderPath)
  const setSearch = useStore(s => s.setSearch)
  const toggleSelected = useStore(s => s.toggleSelected)
  const selectAll = useStore(s => s.selectAll)
  const clearAll = useStore(s => s.clearAll)
  const copyFileTree = useStore(s => s.copyFileTree)
  const { ref: asideRef, style: sizeStyle, handleProps } = useResizable<HTMLElement>({ axis: 'x', initial: 320, min: 220, max: 600, storageKey: 'sidebar-width' })
  const filteredFiles = useMemo(() => files.filter(f => f.name.toLowerCase().includes(search.toLowerCase())), [files, search])
  const tree = useMemo(() => (folderPath ? buildTree(filteredFiles, folderPath) : null), [filteredFiles, folderPath])
  const notify = useNotify()

  return (
    <aside ref={asideRef} className="border-r bg-white dark:bg-neutral-800 flex flex-col relative shrink-0 min-h-0 h-full" style={sizeStyle}>
      <div className="p-4 border-b pt-10 drag-region">
        {!folderPath ? null : (
          <div className="relative no-drag">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-10 py-1 border border-neutral-600 rounded text-sm focus:border-blue-500 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 focus:outline-none">
                <X className="text-neutral-500 dark:text-neutral-400" size={16} />
              </button>
            )}
          </div>
        )}
      </div>
      {folderPath && (
        <>
          <div className="p-4 border-b">
            <button
              onClick={async () => { const r = await copyFileTree(); notify.notify(r.success ? 'Copied file tree' : r.error || 'Copy failed') }}
              className="w-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 py-1 rounded text-sm flex items-center justify-center gap-2 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              <Copy className="h-4 w-4" />
              Copy Tree
            </button>
          </div>
          <div className="flex space-x-2 p-4 border-b">
            <button onClick={selectAll} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 py-1 rounded text-sm transition-colors duration-150 ease-in-out hover:bg-neutral-300 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600">Select All</button>
            <button onClick={clearAll} className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 py-1 rounded text-sm transition-colors duration-150 ease-in-out hover:bg-neutral-300 dark:hover:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600">Deselect All</button>
          </div>
          <nav className="overflow-auto flex-1 p-4">
            {tree && (tree.children.length || tree.files.length) ? (
              <>
                {tree.children.map(child => (
                  <Directory key={child.name} node={child} selected={selected} toggleSelected={toggleSelected} expandAll={Boolean(search)} />
                ))}
                {tree.files.map(f => (
                  <FileItem key={f.id} file={f} selected={selected.has(f.id)} toggleSelected={() => toggleSelected(f.id)} />
                ))}
              </>
            ) : (
              <div className="text-neutral-400 dark:text-neutral-500">No files found.</div>
            )}
          </nav>
          <div className="absolute top-0 right-0 h-full w-1 cursor-col-resize no-drag" onMouseDown={handleProps.onMouseDown}>
            <div className="w-full h-full bg-transparent hover:bg-neutral-300/40 dark:hover:bg-neutral-600/40" />
          </div>
          {notify.message && <Notify message={notify.message} />}
        </>
      )}
    </aside>
  )
}
