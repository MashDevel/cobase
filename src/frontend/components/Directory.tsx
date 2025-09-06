import { useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
} from 'lucide-react';
import FileItem from './FileItem';
import type { TreeNode } from '../services/tree';
import { getAllFileIds } from '../services/tree';

interface DirectoryProps {
  node: TreeNode;
  selected: Set<string>;
  toggleSelected: (id: string) => void;
  depth?: number;
}

export default function Directory({
  node,
  selected,
  toggleSelected,
  depth = 0,
}: DirectoryProps) {
  const [open, setOpen] = useState(false);
  const indent = depth * 16;

  const descendantIds = useMemo(() => getAllFileIds(node), [node]);
  const allSelected =
    descendantIds.length > 0 &&
    descendantIds.every(id => selected.has(id));

  const onFolderCheck = () => {
    if (!allSelected) {
      descendantIds.forEach(id => {
        if (!selected.has(id)) toggleSelected(id);
      });
    } else {
      descendantIds.forEach(id => {
        if (selected.has(id)) toggleSelected(id);
      });
    }
  };

  return (
    <div>
      <div className="flex items-center mb-2" style={{ paddingLeft: indent }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onFolderCheck}
          className="mr-2 form-checkbox"
        />
        <div
        className="flex items-center justify-between w-full cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
        >
        <div className="flex items-center">
            {open ? (
            <ChevronDownIcon className="h-4 w-4 mr-1 text-neutral-500 dark:text-neutral-300" />
            ) : (
            <ChevronRightIcon className="h-4 w-4 mr-1 text-neutral-500 dark:text-neutral-300" />
            )}
            <FolderIcon className="h-4 w-4 mr-2 text-neutral-500 dark:text-neutral-300" />
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {node.name}
            </span>
        </div>
        <span className="text-xs text-neutral-400 mr-2">~{node.tokens}</span>
        </div>
      </div>

      {open && (
        <div>
          {node.children.map(child => (
            <Directory
              key={child.name}
              node={child}
              selected={selected}
              toggleSelected={toggleSelected}
              depth={depth + 1}
            />
          ))}
          {node.files.map(f => (
            <FileItem
              key={f.id}
              file={f}
              selected={selected.has(f.id)}
              toggleSelected={() => toggleSelected(f.id)}
              indent={indent + 16}
            />
          ))}
        </div>
      )}
    </div>
  );
}
