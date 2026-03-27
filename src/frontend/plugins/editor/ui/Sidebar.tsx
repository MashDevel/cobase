import { type Dispatch, type MouseEvent, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Search, X } from 'lucide-react'
import useResizable from '../../../hooks/useResizable'
import useExplorerStore, { setupListeners } from '../../explorer/store'
import { buildTree, type TreeNode, type FileLike } from '../../explorer/services/tree'
import ContextMenu, { type ContextMenuTarget } from '../../explorer/ui/parts/ContextMenu'
import useEditorStore, { openEditorFile } from '../store'
import { getFileIcon } from '../fileIcons'
import { useNotify } from '../../../hooks/useNotify'
import Notify from '../../../components/Notify'

type SectionHeaderProps = {
  title: string
  open: boolean
  onToggle: () => void
  right?: ReactNode
}

function SectionHeader({ title, open, onToggle, right }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
      <button className="flex items-center gap-1 cursor-pointer" onClick={onToggle}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span>{title}</span>
      </button>
      {right}
    </div>
  )
}

type FileRowProps = {
  file: FileLike
  depth: number
  activePath: string | null
  dirtyPaths: Set<string>
  onContextMenu: (target: ContextMenuTarget, event: MouseEvent<HTMLButtonElement>) => void
}

function FileRow({ file, depth, activePath, dirtyPaths, onContextMenu }: FileRowProps) {
  const isActive = file.fullPath === activePath
  const isDirty = dirtyPaths.has(file.fullPath)
  const icon = getFileIcon(file.fullPath)

  return (
    <button
      className={`w-full h-6 px-3 text-left flex items-center gap-2 text-[13px] rounded-sm cursor-pointer ${isActive ? 'bg-neutral-200/80 text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-neutral-800/80'}`}
      style={{ paddingLeft: 12 + depth * 14 }}
      onClick={() => void openEditorFile(file.fullPath)}
      onContextMenu={(event) => {
        event.preventDefault()
        window.getSelection()?.removeAllRanges()
        onContextMenu({ kind: 'file', path: file.fullPath, name: file.name, x: event.clientX, y: event.clientY }, event)
      }}
      onMouseDown={(event) => {
        if (event.button === 2) event.preventDefault()
      }}
      title={file.fullPath}
    >
      <span className={`shrink-0 ${icon.className}`}>{icon.icon}</span>
      <span className="truncate flex-1">{file.name}</span>
      {isDirty ? <span className="text-[10px] leading-none text-neutral-700 dark:text-neutral-300">●</span> : null}
    </button>
  )
}

type TreeBranchProps = {
  node: TreeNode
  path: string
  depth: number
  activePath: string | null
  dirtyPaths: Set<string>
  expanded: Record<string, boolean>
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>
  onContextMenu: (target: ContextMenuTarget, event: MouseEvent<HTMLButtonElement>) => void
}

function TreeBranch({ node, path, depth, activePath, dirtyPaths, expanded, setExpanded, onContextMenu }: TreeBranchProps) {
  const branchPath = path ? `${path}/${node.name}` : node.name
  const isOpen = expanded[branchPath] ?? depth < 1

  return (
    <div>
      <button
        className="w-full h-6 px-3 text-left flex items-center gap-1 text-[13px] rounded-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-neutral-800/80 cursor-pointer"
        style={{ paddingLeft: 12 + depth * 14 }}
        onClick={() => setExpanded((state) => ({ ...state, [branchPath]: !isOpen }))}
        onContextMenu={(event) => {
          event.preventDefault()
          window.getSelection()?.removeAllRanges()
          onContextMenu({ kind: 'directory', path: branchPath, name: node.name, x: event.clientX, y: event.clientY }, event)
        }}
        onMouseDown={(event) => {
          if (event.button === 2) event.preventDefault()
        }}
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" /> : <Folder className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen ? (
        <div>
          {node.children.map((child) => (
            <TreeBranch
              key={`${branchPath}/${child.name}`}
              node={child}
              path={branchPath}
              depth={depth + 1}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              expanded={expanded}
              setExpanded={setExpanded}
              onContextMenu={onContextMenu}
            />
          ))}
          {node.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              depth={depth + 1}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function Sidebar() {
  const files = useExplorerStore((state) => state.files)
  const folderPath = useExplorerStore((state) => state.folderPath)
  const initialized = useExplorerStore((state) => state.initialized)
  const initFromLastFolder = useExplorerStore((state) => state.initFromLastFolder)
  const activePath = useEditorStore((state) => state.activePath)
  const buffers = useEditorStore((state) => state.buffers)
  const [query, setQuery] = useState('')
  const [explorerVisible, setExplorerVisible] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<ContextMenuTarget | null>(null)
  const { ref, style, handleProps } = useResizable<HTMLElement>({
    axis: 'x',
    initial: 280,
    min: 220,
    max: 520,
    storageKey: 'editor-sidebar-width',
  })

  useEffect(() => {
    void setupListeners().then(() => {
      if (!useExplorerStore.getState().initialized) {
        void useExplorerStore.getState().initFromLastFolder()
      }
    })
  }, [initialized, initFromLastFolder])

  const filteredFiles = useMemo(() => {
    if (!query.trim()) return files
    const value = query.toLowerCase()
    return files.filter((file) => file.fullPath.toLowerCase().includes(value) || file.name.toLowerCase().includes(value))
  }, [files, query])

  const tree = useMemo(() => (folderPath ? buildTree(filteredFiles, folderPath) : null), [filteredFiles, folderPath])
  const dirtyPaths = useMemo(
    () => new Set(Object.values(buffers).filter((buffer) => buffer.value !== buffer.savedValue).map((buffer) => buffer.path)),
    [buffers]
  )
  const folderName = folderPath?.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
  const notify = useNotify()

  useEffect(() => {
    const onPointer = () => setMenu(null)
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <aside ref={ref} className="border-r border-neutral-200 dark:border-neutral-800 bg-[#f7f7f7] dark:bg-[#181818] flex flex-col relative shrink-0 min-h-0 h-full" style={style}>
      {folderPath ? (
        <>
          <div className="p-4 pt-10 border-b border-neutral-200 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files"
                className="w-full h-8 pl-8 pr-8 rounded bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-[13px] text-neutral-800 dark:text-neutral-200 outline-none"
              />
              {query ? (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" onClick={() => setQuery('')}>
                  <X className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <SectionHeader title={folderName} open={explorerVisible} onToggle={() => setExplorerVisible((value) => !value)} />
            {explorerVisible ? (
              <div className="px-1">
                {tree && (tree.children.length > 0 || tree.files.length > 0) ? (
                  <div>
                    {tree.children.map((child) => (
                      <TreeBranch
                        key={child.name}
                        node={child}
                        path={folderPath}
                        depth={0}
                        activePath={activePath}
                        dirtyPaths={dirtyPaths}
                        expanded={expanded}
                        setExpanded={setExpanded}
                        onContextMenu={(target) => setMenu(target)}
                      />
                    ))}
                    {tree.files.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        depth={0}
                        activePath={activePath}
                        dirtyPaths={dirtyPaths}
                        onContextMenu={(target) => setMenu(target)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-2 py-2 text-[12px] text-neutral-500 dark:text-neutral-400">No files found</div>
                )}
              </div>
            ) : null}
          </div>
          <div className="absolute top-0 right-0 h-full w-1 cursor-col-resize no-drag" onMouseDown={handleProps.onMouseDown}>
            <div className="w-full h-full bg-transparent hover:bg-neutral-300/50 dark:hover:bg-neutral-600/40" />
          </div>
          {menu ? <ContextMenu target={menu} onClose={() => setMenu(null)} notify={notify.notify} /> : null}
          {notify.message ? <Notify message={notify.message} /> : null}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
          Open a folder to browse files.
        </div>
      )}
    </aside>
  )
}
