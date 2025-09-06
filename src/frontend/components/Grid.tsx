import { useState, useMemo } from 'react';
import useStore from '../store';
import { X as XIcon } from 'lucide-react';
import { selectSelectedFiles, selectSelectedTotalTokens, selectSelectedTotalLines } from '../selectors';

interface GridItemProps {
  f: any;
  onRemove: (id: string) => void;
}

const GridItem = ({ f, onRemove }: GridItemProps) => {
  return (
    <div
      key={f.id}
      className="relative group border border-sky-800 rounded p-4 bg-white dark:bg-neutral-800 shadow-sm hover:bg-neutral-200 dark:hover:bg-neutral-700"
    >
      <button
        onClick={() => onRemove(f.id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label={`Remove ${f.name}`}
      >
        <XIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-300" />
      </button>

      <div className="font-mono text-sm truncate text-neutral-900 dark:text-neutral-100 flex items-center">
        {f.name}
      </div>
      <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        ~{f.tokens} tokens ∣ ~{f.lines} lines
      </div>
    </div>
  );
};

export default function Grid() {
  const selectedFiles = useStore(selectSelectedFiles);
  const totalTokens = useStore(selectSelectedTotalTokens);
  const totalLines = useStore(selectSelectedTotalLines);
  const toggleSelected = useStore(state => state.toggleSelected);

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedFiles = useMemo(() => {
    return [...selectedFiles].sort((a, b) =>
      sortOrder === 'desc' ? b.tokens - a.tokens : a.tokens - b.tokens
    );
  }, [selectedFiles, sortOrder]);

  const toggleSort = () =>
    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between p-4 shrink-0">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {selectedFiles.length} files ∣ ~{totalTokens} tokens ∣ ~{totalLines} lines
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSort}
            className="flex items-center space-x-1 text-sm text-neutral-800 dark:text-neutral-200"
          >
            <span>
              Sort: {sortOrder === 'desc' ? 'High to Low' : 'Low to High'}
            </span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={sortOrder === 'desc' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-4">
          {sortedFiles.length > 0 ? (
            sortedFiles.map(f => (
              <GridItem key={f.id} f={f} onRemove={toggleSelected} />
            ))
          ) : (
            <div className="col-span-3 text-center text-neutral-400 dark:text-neutral-500">
              No files selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
