import { FileIcon } from 'lucide-react';
import type { FileEntry as File } from '../store';

interface FileItemProps {
  file: File;
  selected: boolean;
  toggleSelected: () => void;
  indent?: number;
}

export default function FileItem({
  file,
  selected,
  toggleSelected,
  indent = 0,
}: FileItemProps) {
  return (
    <label
      className="flex items-center justify-between mb-2"
      style={{ paddingLeft: indent }}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={toggleSelected}
          className="mr-2 form-checkbox"
        />
        <FileIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-300 mr-1" />
        <span className="text-neutral-800 dark:text-neutral-200">
          {file.name}
        </span>
      </div>
      <span className="text-xs text-neutral-400 mr-2">
        ~{file.tokens}
      </span>
    </label>
  );
}
