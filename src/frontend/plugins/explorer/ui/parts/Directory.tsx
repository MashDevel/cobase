import { type MouseEvent, useEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from 'lucide-react'
import type { TreeNode } from '../../services/tree'
import { getAllFileIds } from '../../services/tree'
import FileItem from './FileItem'
import TreeRow from './TreeRow'

type Props = {
  node: TreeNode
  path: string
  selected: Set<string>
  toggleSelected: (id: string) => void
  depth?: number
  expandAll?: boolean
  onContextMenu?: (target: { kind: 'directory' | 'file'; path: string; name: string }, event: MouseEvent<HTMLDivElement | HTMLButtonElement>) => void
}

export default function Directory({ node, path, selected, toggleSelected, depth = 0, expandAll = false, onContextMenu }: Props) {
  const [open, setOpen] = useState(expandAll)
  useEffect(() => { setOpen(expandAll) }, [expandAll])
  const indent = depth * 16
  const fullPath = path ? `${path}/${node.name}` : node.name
  const descendantIds = useMemo(() => getAllFileIds(node), [node])
  const allSelected = descendantIds.length > 0 && descendantIds.every(id => selected.has(id))
  const onFolderCheck = () => {
    if (!allSelected) descendantIds.forEach(id => { if (!selected.has(id)) toggleSelected(id) })
    else descendantIds.forEach(id => { if (selected.has(id)) toggleSelected(id) })
  }
  return (
    <div>
      <TreeRow
        indent={indent}
        checked={allSelected}
        onCheck={onFolderCheck}
        onClick={() => setOpen(o => !o)}
        onContextMenu={onContextMenu ? (event) => onContextMenu({ kind: 'directory', path: fullPath, name: node.name }, event) : undefined}
        left={open ? (
          <>
            <ChevronDownIcon className="h-4 w-4 mr-1 text-neutral-500 dark:text-neutral-300" />
            <FolderIcon className="h-4 w-4 mr-2 text-neutral-500 dark:text-neutral-300" />
          </>
        ) : (
          <>
            <ChevronRightIcon className="h-4 w-4 mr-1 text-neutral-500 dark:text-neutral-300" />
            <FolderIcon className="h-4 w-4 mr-2 text-neutral-500 dark:text-neutral-300" />
          </>
        )}
        name={node.name}
        nameBold
        meta={`~${node.tokens}T ∣ ~${node.lines}L`}
      />
      {open && (
        <div>
          {node.children.map(child => (
            <Directory key={child.name} node={child} path={fullPath} selected={selected} toggleSelected={toggleSelected} depth={depth + 1} expandAll={expandAll} onContextMenu={onContextMenu} />
          ))}
          {node.files.map(f => (
            <FileItem
              key={f.id}
              file={f}
              selected={selected.has(f.id)}
              toggleSelected={() => toggleSelected(f.id)}
              indent={indent + 16}
              onContextMenu={onContextMenu ? (event) => onContextMenu({ kind: 'file', path: f.fullPath, name: f.name }, event) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
