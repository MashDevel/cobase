import { useEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, FolderIcon } from 'lucide-react'
import type { TreeNode } from '../../services/tree'
import { getAllFileIds } from '../../services/tree'
import FileItem from './FileItem'
import TreeRow from './TreeRow'

type Props = {
  node: TreeNode
  selected: Set<string>
  toggleSelected: (id: string) => void
  depth?: number
  expandAll?: boolean
}

export default function Directory({ node, selected, toggleSelected, depth = 0, expandAll = false }: Props) {
  const [open, setOpen] = useState(expandAll)
  useEffect(() => { setOpen(expandAll) }, [expandAll])
  const indent = depth * 16
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
            <Directory key={child.name} node={child} selected={selected} toggleSelected={toggleSelected} depth={depth + 1} expandAll={expandAll} />
          ))}
          {node.files.map(f => (
            <FileItem key={f.id} file={f} selected={selected.has(f.id)} toggleSelected={() => toggleSelected(f.id)} indent={indent + 16} />
          ))}
        </div>
      )}
    </div>
  )
}
